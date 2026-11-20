// Verique background service worker.
// Owns every check: it reads text from the tab (through the injected panel script), calls the
// API, and hands results to the panel on the page. The latest check is mirrored to
// chrome.storage.session under JOB_KEY so the popup can show it, even if it was closed meanwhile.

importScripts('shared.js');

const JOB_KEY = 'job';
const REQUEST_TIMEOUT_MS = 600_000; // about a minute per claim, so a long page takes several
const KEEPALIVE_MS = 20_000; // an idle MV3 worker is stopped after 30s

let currentJobId = null;

// ---------------------------------------------------------------------------
// Entry points: context menu, keyboard shortcuts, popup, panel
// ---------------------------------------------------------------------------

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'verify-selection',
      title: 'Fact-check selection with Verique',
      contexts: ['selection'],
    });
    chrome.contextMenus.create({
      id: 'verify-page',
      title: 'Fact-check this page with Verique',
      contexts: ['page'],
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id) return;
  const source = info.menuItemId === 'verify-selection' ? 'selection' : 'page';
  startTabCheck(tab, source, info.selectionText || '');
});

chrome.commands.onCommand.addListener(async (command, tab) => {
  tab = tab || (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  if (!tab?.id) return;
  startTabCheck(tab, command === 'verify-selection' ? 'selection' : 'page');
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const reply = (promise) => {
    promise.then(sendResponse, (err) => sendResponse({ ok: false, error: err.message }));
    return true; // keep the channel open for the async reply
  };

  switch (msg?.action) {
    case 'checkTab': // from the popup: { tabId, source: 'page' | 'selection' }
      return reply(chrome.tabs.get(msg.tabId).then((tab) => startTabCheck(tab, msg.source)));
    case 'checkText': // from the popup: pasted text, results shown in the popup
      runCheck({ text: msg.text, source: 'text' });
      sendResponse({ ok: true });
      return false;
    case 'retry': // from the panel's "Try again" button
      if (sender.tab) startTabCheck(sender.tab, msg.source === 'selection' ? 'selection' : 'page');
      return false;
    case 'apiStatus':
      return reply(checkApiStatus());
    default:
      return false;
  }
});

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

/**
 * Check the page (or its selection) in `tab`. Resolves once the panel is on the page, with
 * { ok: true } or { ok: false, error }; the API call itself carries on in the background.
 */
async function startTabCheck(tab, source, fallbackText = '') {
  if (!/^(https?|file):/.test(tab.url || '')) {
    return fail("Verique can't read this page. Browser pages, the Chrome Web Store and PDFs are off-limits.");
  }
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content/content.js'] });
  } catch (err) {
    return fail(`Verique can't read this page (${err.message}).`);
  }

  const page = await sendToTab(tab.id, { action: source === 'selection' ? 'getSelection' : 'getPageContent' });
  const text = (page?.text || fallbackText || '').trim();
  if (!text) {
    const message = source === 'selection'
      ? 'Select some text on the page first, then try again.'
      : "Couldn't find any text on this page.";
    sendToTab(tab.id, { action: 'showError', message, source });
    return fail(message);
  }

  runCheck({ text, source, tabId: tab.id, url: tab.url, title: tab.title });
  return { ok: true };

  function fail(error) {
    saveJob({ id: crypto.randomUUID(), status: 'error', source, error, title: tab.title, finishedAt: Date.now() });
    return { ok: false, error };
  }
}

async function runCheck({ text, source, tabId = null, url = null, title = null }) {
  const id = crypto.randomUUID();
  currentJobId = id;
  text = String(text || '').trim();
  const truncated = text.length > VERIQUE_MAX_CHARS;
  if (truncated) text = text.slice(0, VERIQUE_MAX_CHARS);

  const job = { id, source, tabId, url, title, truncated, chars: text.length, startedAt: Date.now() };

  if (text.length < VERIQUE_MIN_CHARS) {
    return finish({ status: 'error', error: 'That is too short to check. Use at least a full sentence.' });
  }

  await saveJob({ ...job, status: 'running' });
  if (tabId) sendToTab(tabId, { action: 'showLoading', source, truncated });

  const keepAlive = setInterval(() => chrome.runtime.getPlatformInfo(), KEEPALIVE_MS);
  try {
    const result = await callVerify(text, url);
    await finish({ status: 'done', result, text: source === 'text' ? text : undefined });
    if (tabId) sendToTab(tabId, { action: 'showResults', result, text, source, truncated });
  } catch (err) {
    await finish({ status: 'error', error: err.message });
    if (tabId) sendToTab(tabId, { action: 'showError', message: err.message, source });
  } finally {
    clearInterval(keepAlive);
  }

  async function finish(fields) {
    // A newer check replaced this one; its tab still gets the results, the popup does not.
    if (currentJobId !== id) return;
    await saveJob({ ...job, ...fields, finishedAt: Date.now() });
  }
}

async function callVerify(text, pageUrl) {
  const { apiBase } = await getVeriqueSettings();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(`${apiBase}/api/v1/verify/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, url: apiSafeUrl(pageUrl), vertical: 'general' }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('The check took more than 10 minutes and was stopped. Try a shorter selection.');
    }
    throw new Error(`Can't reach the Verique API at ${apiBase}. Is the backend running?`);
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) throw new Error(await errorMessage(response));
  const result = await response.json();
  // "failed" with no claims means the pipeline broke before checking anything (for example the
  // model returned malformed JSON while extracting claims); that is an error, not an empty page.
  if (result.status === 'failed' && !result.claims?.length) {
    throw new Error("The AI service had a problem and couldn't finish this check. Please try again.");
  }
  return result;
}

/** The API validates `url` as an http(s) URL, so send only those (and drop the #fragment). */
function apiSafeUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    url.hash = '';
    return url.href.length <= 2000 ? url.href : null;
  } catch {
    return null;
  }
}

/** FastAPI errors carry `detail` as a string, an {error, message} object, or a validation list. */
async function errorMessage(response) {
  const body = await response.json().catch(() => null);
  const detail = body?.detail;
  if (typeof detail === 'string') return detail;
  if (detail?.message) return detail.message;
  if (Array.isArray(detail) && detail[0]?.msg) return `The API rejected the request: ${detail[0].msg}`;
  if (response.status === 429) return 'Too many checks right now. Please try again in a few minutes.';
  return `The check failed (HTTP ${response.status}).`;
}

async function checkApiStatus() {
  const { apiBase } = await getVeriqueSettings();
  try {
    const response = await fetch(`${apiBase}/health`, { signal: AbortSignal.timeout(5000) });
    return { online: response.ok, apiBase };
  } catch {
    return { online: false, apiBase };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function saveJob(job) {
  return chrome.storage.session.set({ [JOB_KEY]: job });
}

/** Message the panel script; resolves to undefined if the tab is gone or navigated away. */
async function sendToTab(tabId, message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch {
    return undefined;
  }
}
