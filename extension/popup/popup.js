// Verique popup: starts checks (background.js runs them) and shows the latest one.

const VERDICTS = {
  strongly_supported: ['Strongly supported', 'good'],
  supported: ['Supported', 'good'],
  mixed: ['Mixed', 'warn'],
  weak: ['Weak evidence', 'warn'],
  outdated: ['Outdated', 'warn'],
  contradicted: ['Contradicted', 'bad'],
  not_verifiable: ['Not verifiable', 'muted'],
};

const $ = (id) => document.getElementById(id);
let activeTab = null;
let elapsedTimer = null;

document.addEventListener('DOMContentLoaded', async () => {
  [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

  const readable = /^(https?|file):/.test(activeTab?.url || '');
  if (!readable) {
    $('check-page').disabled = true;
    $('check-selection').disabled = true;
    showHint("Verique can't read this tab (browser pages and the Web Store are off-limits). Open a web page, or paste text below.");
  }

  $('check-page').addEventListener('click', () => checkTab('page'));
  $('check-selection').addEventListener('click', () => checkTab('selection'));
  $('check-text').addEventListener('click', checkText);
  $('text-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) checkText();
  });

  await loadSettings();
  $('settings-form').addEventListener('submit', saveSettings);
  $('reset-settings').addEventListener('click', resetSettings);

  const { job } = await chrome.storage.session.get('job');
  renderJob(job);
  chrome.storage.session.onChanged.addListener((changes) => {
    if (changes.job) renderJob(changes.job.newValue);
  });

  refreshApiStatus();
});

// ---------------------------------------------------------------------------
// Starting checks
// ---------------------------------------------------------------------------

async function checkTab(source) {
  setBusy(true);
  const response = await chrome.runtime.sendMessage({ action: 'checkTab', tabId: activeTab.id, source });
  if (response?.ok) {
    window.close(); // progress and results show in the panel on the page
    return;
  }
  setBusy(false);
  // The background also saved the error as the latest job, which renders below.
  if (response?.error) showHint(response.error);
}

async function checkText() {
  const text = $('text-input').value.trim();
  if (!text) {
    $('text-input').focus();
    return;
  }
  await chrome.runtime.sendMessage({ action: 'checkText', text });
}

function setBusy(busy) {
  for (const id of ['check-page', 'check-selection', 'check-text']) {
    if (busy) $(id).disabled = true;
    else $(id).disabled = id !== 'check-text' && !/^(https?|file):/.test(activeTab?.url || '');
  }
}

function showHint(text) {
  $('page-hint').textContent = text;
  $('page-hint').hidden = !text;
}

// ---------------------------------------------------------------------------
// The latest check
// ---------------------------------------------------------------------------

function renderJob(job) {
  const box = $('job');
  clearInterval(elapsedTimer);
  if (!job) {
    box.hidden = true;
    setBusy(false);
    return;
  }
  box.hidden = false;
  const what = describe(job);

  if (job.status === 'running') {
    setBusy(true);
    const sub = el('div', 'job-sub', 'About a minute per claim.');
    box.replaceChildren(
      heading('Latest check'),
      el('div', 'job-head', el('div', 'spinner'), el('div', '', el('div', 'job-title', `Checking ${what}…`), sub)),
    );
    const tick = () => {
      sub.textContent = `About a minute per claim · ${Math.round((Date.now() - job.startedAt) / 1000)}s so far`;
    };
    tick();
    elapsedTimer = setInterval(tick, 1000);
    return;
  }

  setBusy(false);
  if (job.status === 'error') {
    box.replaceChildren(heading('Latest check'), el('div', 'error-box', job.error || 'The check failed.'));
    return;
  }

  const result = job.result || {};
  const claims = Array.isArray(result.claims) ? result.claims : [];
  const score = Number(result.page_score ?? 0);
  const tone = claims.length ? (score >= 70 ? 'good' : score >= 50 ? 'warn' : 'bad') : 'muted';
  const sources = result.metadata?.sources_checked ?? 0;

  const children = [
    heading('Latest check'),
    el('div', 'job-head',
      el('div', `score tone-${tone}`, claims.length ? String(score) : '–'),
      el('div', '',
        el('div', 'job-title', claims.length ? `Trust score for ${what}` : `No checkable claims in ${what}`),
        el('div', 'job-sub', claims.length
          ? `${plural(claims.length, 'claim')} · ${plural(sources, 'source')}${job.source === 'text' ? '' : ' · details are on the page'}`
          : 'Nothing in it can be checked against sources.'),
      ),
    ),
  ];
  if (result.status === 'failed') {
    children.push(el('div', 'note', "Some claims couldn't be checked, so the score may be incomplete."));
  }
  if (job.truncated) children.push(el('div', 'note', 'Only the first 50,000 characters were checked.'));

  // Pasted text has no page to show results on, so list the claims here.
  if (job.source === 'text' && claims.length) {
    children.push(el('ul', 'claims', ...claims.map((claim) => {
      const [label, claimTone] = VERDICTS[claim.verdict] || VERDICTS.not_verifiable;
      return el('li', '',
        el('span', `chip tone-${claimTone}`, label),
        el('p', 'claim-text', claim.text || ''),
        claim.reasoning ? el('p', 'reasoning', claim.reasoning) : null,
      );
    })));
  }
  box.replaceChildren(...children);
}

function describe(job) {
  if (job.source === 'text') return 'your text';
  if (job.source === 'selection') return 'the selection';
  return job.title ? `“${truncate(job.title, 48)}”` : 'the page';
}

// ---------------------------------------------------------------------------
// API status and settings
// ---------------------------------------------------------------------------

async function refreshApiStatus() {
  const status = $('api-status');
  status.classList.remove('online', 'offline');
  status.querySelector('.status-text').textContent = 'Checking API…';
  const { online, apiBase } = (await chrome.runtime.sendMessage({ action: 'apiStatus' })) || {};
  status.classList.add(online ? 'online' : 'offline');
  status.querySelector('.status-text').textContent = online ? 'API online' : 'API offline';
  status.title = online ? `Connected to ${apiBase}` : `No answer from ${apiBase}. Start the backend or change the API URL in Settings.`;
}

async function loadSettings() {
  const { apiBase, appUrl } = await getVeriqueSettings();
  $('api-base').value = apiBase;
  $('app-url').value = appUrl;
  $('open-app').href = appUrl;
}

async function saveSettings(event) {
  event.preventDefault();
  const apiBase = normalizeBaseUrl($('api-base').value);
  const appUrl = normalizeBaseUrl($('app-url').value);
  if (!apiBase || !appUrl) return settingsMessage('Use full http:// or https:// addresses.');

  // The extension can only call hosts it has permission for; ask for a new API host once.
  const granted = await chrome.permissions.request({ origins: [`${new URL(apiBase).origin}/*`] }).catch(() => false);
  if (!granted) return settingsMessage('Permission for that API host was not granted.');

  await chrome.storage.sync.set({ apiBase, appUrl });
  await loadSettings();
  settingsMessage('Saved.');
  refreshApiStatus();
}

async function resetSettings() {
  await chrome.storage.sync.remove(['apiBase', 'appUrl']);
  await loadSettings();
  settingsMessage('Back to the defaults.');
  refreshApiStatus();
}

function settingsMessage(text) {
  $('settings-msg').textContent = text;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function el(tag, className, ...children) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  for (const child of children) {
    if (child == null) continue;
    node.append(child instanceof Node ? child : String(child));
  }
  return node;
}

function heading(text) {
  return el('h2', '', text);
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function truncate(text, max) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
