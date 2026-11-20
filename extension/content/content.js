// Verique panel. Injected on demand by background.js (chrome.scripting), never on every page.
// Draws a results panel in a shadow root (so page CSS can't reach it) and highlights the
// checked claims in the page. Everything from the page or the API goes in as text, never HTML.

(() => {
  if (window.__veriquePanel) return; // already injected into this page
  window.__veriquePanel = true;

  const VERDICTS = {
    strongly_supported: { label: 'Strongly supported', tone: 'good' },
    supported: { label: 'Supported', tone: 'good' },
    mixed: { label: 'Mixed', tone: 'warn' },
    weak: { label: 'Weak evidence', tone: 'warn' },
    outdated: { label: 'Outdated', tone: 'warn' },
    contradicted: { label: 'Contradicted', tone: 'bad' },
    not_verifiable: { label: 'Not verifiable', tone: 'muted' },
  };
  // Highlight colours in the page (inline, since page CSS can't see the shadow root's).
  const MARK_TONES = {
    good: ['rgba(22, 163, 74, 0.18)', '#16a34a'],
    warn: ['rgba(217, 119, 6, 0.2)', '#d97706'],
    bad: ['rgba(220, 38, 38, 0.18)', '#dc2626'],
    muted: ['rgba(107, 114, 128, 0.18)', '#6b7280'],
  };
  const SKIP_TEXT_IN = 'script, style, noscript, textarea, input, select, option, template, #verique-root';

  let host = null;
  let shadow = null;
  let lastSource = 'page';
  let elapsedTimer = null;
  let marksByClaim = new Map();

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    switch (msg?.action) {
      case 'getSelection':
        sendResponse({ text: window.getSelection()?.toString() || '' });
        return false;
      case 'getPageContent':
        sendResponse({ text: mainText() });
        return false;
      case 'showLoading':
        lastSource = msg.source;
        renderLoading(msg.source, msg.truncated);
        break;
      case 'showResults':
        lastSource = msg.source;
        renderResults(msg.result, msg.text, msg.truncated);
        break;
      case 'showError':
        lastSource = msg.source || lastSource;
        renderError(msg.message);
        break;
    }
    sendResponse({ ok: true });
    return false;
  });

  /** The article body if the page has an obvious one, otherwise the whole page. */
  function mainText() {
    const candidates = document.querySelectorAll(
      'article, [role="main"], main, .post-content, .article-content, .entry-content, #content'
    );
    let best = '';
    for (const el of candidates) {
      const text = el.innerText || '';
      if (text.length > best.length) best = text;
    }
    return best.length > 200 ? best : document.body?.innerText || '';
  }

  // -------------------------------------------------------------------------
  // Panel shell
  // -------------------------------------------------------------------------

  function ensurePanel() {
    if (host?.isConnected) return;
    host = document.createElement('div');
    host.id = 'verique-root';
    host.style.cssText = 'all: initial; position: fixed; z-index: 2147483647; top: 0; right: 0;';
    shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `<style>${PANEL_CSS}</style>
      <aside class="panel" role="dialog" aria-label="Verique fact-check">
        <header>
          <span class="logo">${LOGO_SVG}</span>
          <strong>Verique</strong>
          <span class="spacer"></span>
          <button class="icon" data-act="minimize" title="Minimise" aria-label="Minimise">&#x2013;</button>
          <button class="icon" data-act="close" title="Close and clear highlights" aria-label="Close">&#x2715;</button>
        </header>
        <div class="body"></div>
      </aside>
      <button class="pill" hidden>${LOGO_SVG}<span></span></button>`;
    shadow.querySelector('[data-act="close"]').addEventListener('click', closePanel);
    shadow.querySelector('[data-act="minimize"]').addEventListener('click', () => setMinimized(true));
    shadow.querySelector('.pill').addEventListener('click', () => setMinimized(false));
    document.documentElement.appendChild(host);
  }

  function setMinimized(minimized) {
    shadow.querySelector('.panel').hidden = minimized;
    shadow.querySelector('.pill').hidden = !minimized;
  }

  function setBody(...children) {
    ensurePanel();
    setMinimized(false);
    clearInterval(elapsedTimer);
    const body = shadow.querySelector('.body');
    body.replaceChildren(...children);
    body.scrollTop = 0;
    return body;
  }

  function setPill(text) {
    ensurePanel();
    shadow.querySelector('.pill span').textContent = text;
  }

  function closePanel() {
    clearInterval(elapsedTimer);
    clearHighlights();
    host?.remove();
    host = null;
  }

  // -------------------------------------------------------------------------
  // States
  // -------------------------------------------------------------------------

  function renderLoading(source, truncated) {
    clearHighlights();
    const elapsed = h('span', { class: 'muted' }, '0s');
    setBody(
      h('div', { class: 'state' },
        h('div', { class: 'spinner', 'aria-hidden': 'true' }),
        h('p', { class: 'title' }, source === 'selection' ? 'Checking your selection…' : 'Checking the claims on this page…'),
        h('p', { class: 'muted' }, 'Each claim takes about a minute to check, so this can take a few minutes. You can keep reading.'),
        elapsed,
        truncated ? h('p', { class: 'note' }, 'The page is long, so only its first 50,000 characters are checked.') : null,
      ),
    );
    setPill('Checking…');
    const started = Date.now();
    elapsedTimer = setInterval(() => {
      elapsed.textContent = `${Math.round((Date.now() - started) / 1000)}s`;
    }, 1000);
  }

  function renderError(message) {
    setBody(
      h('div', { class: 'state' },
        h('p', { class: 'title' }, "Couldn't check this"),
        h('p', { class: 'error' }, message),
        h('button', { class: 'primary', onclick: () => chrome.runtime.sendMessage({ action: 'retry', source: lastSource }) }, 'Try again'),
      ),
    );
    setPill('Check failed');
  }

  function renderResults(result, sourceText, truncated) {
    clearHighlights();
    const claims = Array.isArray(result?.claims) ? result.claims : [];
    const score = Number(result?.page_score ?? 0);
    const tone = score >= 70 ? 'good' : score >= 50 ? 'warn' : 'bad';
    const sources = result?.metadata?.sources_checked ?? 0;

    if (claims.length) highlightClaims(claims, sourceText || '');

    const summary = h('section', { class: 'score' },
      claims.length
        ? h('div', { class: `big tone-${tone}` }, String(score))
        : h('div', { class: 'big tone-muted' }, '–'),
      h('div', {},
        h('div', { class: 'title' }, claims.length ? 'Trust score' : 'No checkable claims'),
        h('div', { class: 'muted' }, claims.length
          ? `${plural(claims.length, 'claim')} checked against ${plural(sources, 'source')}`
          : 'No factual claims that can be checked against sources were found.'),
      ),
    );

    const counts = tallyByVerdict(claims);
    const tally = counts.length
      ? h('div', { class: 'tally' }, ...counts.map(([verdict, n]) =>
          h('span', { class: `chip tone-${VERDICTS[verdict]?.tone || 'muted'}` }, `${n} ${verdictLabel(verdict).toLowerCase()}`)))
      : null;

    const notes = [
      result?.status === 'failed' ? "Some claims couldn't be checked (the AI service had trouble), so the score may be incomplete." : null,
      truncated ? 'The page is long, so only its first 50,000 characters were checked.' : null,
      result?.metadata?.cached ? 'This text was checked recently; showing the saved result.' : null,
    ].filter(Boolean).map((text) => h('p', { class: 'note' }, text));

    const found = claims.filter((c) => marksByClaim.has(c.id)).length;
    const hint = claims.length
      ? h('p', { class: 'muted small' }, found
          ? `${plural(found, 'claim')} highlighted on the page. Click a highlight to jump to its card.`
          : "The claims couldn't be matched to the page text, so nothing is highlighted.")
      : null;

    setBody(summary, tally, ...notes, hint, h('div', { class: 'claims' }, ...claims.map(claimCard)));
    setPill(claims.length ? `Score ${score}` : 'No claims');
  }

  function claimCard(claim) {
    const verdict = VERDICTS[claim.verdict] ? claim.verdict : 'not_verifiable';
    const tone = VERDICTS[verdict].tone;
    const supporting = claim.sources?.supporting || [];
    const contradicting = claim.sources?.contradicting || [];
    const marks = marksByClaim.get(claim.id);

    return h('article', { class: 'claim', 'data-claim': claim.id },
      h('div', { class: 'row' },
        h('span', { class: `chip tone-${tone}` }, verdictLabel(verdict)),
        typeof claim.confidence === 'number' ? h('span', { class: 'muted small' }, `${Math.round(claim.confidence * 100)}% confidence`) : null,
        h('span', { class: 'spacer' }),
        marks ? h('button', { class: 'link', onclick: () => focusMark(claim.id) }, 'Show on page') : null,
      ),
      h('p', { class: 'claim-text' }, claim.text || ''),
      claim.reasoning ? h('p', { class: 'reasoning' }, claim.reasoning) : null,
      claim.caveats?.length ? h('ul', { class: 'caveats' }, ...claim.caveats.map((c) => h('li', {}, c))) : null,
      supporting.length + contradicting.length
        ? h('details', {},
            h('summary', {}, `Sources (${supporting.length + contradicting.length})`),
            ...supporting.map((s) => sourceLink(s, 'supports')),
            ...contradicting.map((s) => sourceLink(s, 'contradicts')),
          )
        : null,
    );
  }

  function sourceLink(source, role) {
    const safe = /^https?:\/\//i.test(source.url || '');
    return h('div', { class: 'source' },
      h('span', { class: `role ${role}` }, role === 'supports' ? 'Supports' : 'Contradicts'),
      safe
        ? h('a', { href: source.url, target: '_blank', rel: 'noopener noreferrer' }, source.domain || source.url)
        : h('span', {}, source.domain || 'Unknown source'),
      source.snippet ? h('p', { class: 'muted small' }, truncate(source.snippet, 220)) : null,
    );
  }

  function focusClaimCard(claimId) {
    if (!host) return;
    setMinimized(false);
    const card = shadow.querySelector(`[data-claim="${CSS.escape(claimId)}"]`);
    if (!card) return;
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    card.classList.remove('flash');
    void card.offsetWidth; // restart the animation
    card.classList.add('flash');
  }

  // -------------------------------------------------------------------------
  // Highlighting claims in the page
  // -------------------------------------------------------------------------

  function highlightClaims(claims, sourceText) {
    for (const claim of claims) {
      // Claims are usually quoted word for word, so look for the claim text first. If the model
      // reworded it, fall back to its span in the text we sent, which is the page's own wording.
      // Spans come from the model too and are often a character or two off, so trim the ends
      // back to whole words.
      const candidates = [];
      if (claim.text) candidates.push(claim.text);
      const [start, end] = Array.isArray(claim.span) ? claim.span : [];
      if (Number.isInteger(start) && Number.isInteger(end) && end - start >= 12 && end <= sourceText.length) {
        const slice = sourceText.slice(start, end).replace(/^\S*\s+/, '').replace(/\s+\S*$/, '');
        candidates.push(slice);
      }

      for (const candidate of candidates) {
        const marks = markText(candidate, claim);
        if (marks.length) {
          marksByClaim.set(claim.id, marks);
          break;
        }
      }
    }
  }

  /** Find `needle` in the page (ignoring case, whitespace and quote styles) and wrap it. */
  function markText(needle, claim) {
    const wanted = normalize(needle);
    if (wanted.length < 12) return [];
    const index = pageIndex();
    const at = index.text.indexOf(wanted);
    if (at === -1) return [];

    // Collect [from, to) offsets per text node, then wrap each piece.
    const pieces = new Map();
    for (let i = at; i < at + wanted.length; i++) {
      const [node, offset] = index.map[i];
      const piece = pieces.get(node);
      if (piece) piece[1] = offset + 1;
      else pieces.set(node, [offset, offset + 1]);
    }

    const [bg, line] = MARK_TONES[VERDICTS[claim.verdict]?.tone || 'muted'];
    const label = `Verique: ${verdictLabel(claim.verdict)}${claim.reasoning ? ` – ${claim.reasoning}` : ''}`;
    const marks = [];
    for (const [node, [from, to]] of pieces) {
      const range = document.createRange();
      range.setStart(node, from);
      range.setEnd(node, to);
      const mark = document.createElement('verique-mark');
      mark.style.cssText = `background:${bg};border-bottom:2px solid ${line};border-radius:2px;cursor:pointer;color:inherit;`;
      mark.title = truncate(label, 300);
      mark.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        focusClaimCard(claim.id);
      });
      range.surroundContents(mark);
      marks.push(mark);
    }
    return marks;
  }

  /** Page text with whitespace removed, plus where each character came from. */
  function pageIndex() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) =>
        node.parentElement && !node.parentElement.closest(SKIP_TEXT_IN) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
    });
    let text = '';
    const map = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const value = node.nodeValue;
      for (let offset = 0; offset < value.length; offset++) {
        const ch = normalizeChar(value[offset]);
        if (!ch) continue;
        for (const c of ch) {
          text += c;
          map.push([node, offset]);
        }
      }
    }
    return { text, map };
  }

  function normalize(value) {
    let out = '';
    for (const c of value) out += normalizeChar(c);
    return out;
  }

  function normalizeChar(c) {
    if (/\s/.test(c)) return '';
    if ('‘’‚‛′'.includes(c)) return "'";
    if ('“”„‟″'.includes(c)) return '"';
    if ('‐‑‒–—―−'.includes(c)) return '-';
    return c.toLowerCase();
  }

  function focusMark(claimId) {
    const marks = marksByClaim.get(claimId);
    if (!marks?.length || !marks[0].isConnected) return;
    marks[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
    for (const mark of marks) {
      mark.animate(
        [{ outline: '3px solid rgba(59, 130, 246, 0.9)' }, { outline: '3px solid rgba(59, 130, 246, 0)' }],
        { duration: 1600, easing: 'ease-out' },
      );
    }
  }

  function clearHighlights() {
    for (const marks of marksByClaim.values()) {
      for (const mark of marks) {
        const parent = mark.parentNode;
        if (!parent) continue;
        mark.replaceWith(...mark.childNodes);
        parent.normalize();
      }
    }
    marksByClaim = new Map();
  }

  // -------------------------------------------------------------------------
  // Small helpers
  // -------------------------------------------------------------------------

  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs || {})) {
      if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value);
      else if (value != null) el.setAttribute(key, value);
    }
    for (const child of children) {
      if (child == null || child === false) continue;
      el.append(child instanceof Node ? child : String(child));
    }
    return el;
  }

  function verdictLabel(verdict) {
    return VERDICTS[verdict]?.label || 'Not verifiable';
  }

  function tallyByVerdict(claims) {
    const counts = new Map();
    for (const c of claims) {
      const v = VERDICTS[c.verdict] ? c.verdict : 'not_verifiable';
      counts.set(v, (counts.get(v) || 0) + 1);
    }
    return Object.keys(VERDICTS).filter((v) => counts.has(v)).map((v) => [v, counts.get(v)]);
  }

  function plural(n, word) {
    return `${n} ${word}${n === 1 ? '' : 's'}`;
  }

  function truncate(text, max) {
    text = String(text);
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
  }

  const LOGO_SVG = '<svg viewBox="0 0 64 64" width="20" height="20" aria-hidden="true"><rect width="64" height="64" rx="14" fill="#3b82f6"/><path d="M19 18l13 30 13-30" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  const PANEL_CSS = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    .panel, .pill {
      --bg: #ffffff; --bg-soft: #f4f6f9; --fg: #111827; --muted: #6b7280; --border: #e3e7ee;
      --accent: #3b82f6; --good: #15803d; --good-bg: rgba(22,163,74,.12); --warn: #b45309; --warn-bg: rgba(217,119,6,.14);
      --bad: #b91c1c; --bad-bg: rgba(220,38,38,.12); --mute: #4b5563; --mute-bg: rgba(107,114,128,.14);
      font: 14px/1.45 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; color: var(--fg);
    }
    @media (prefers-color-scheme: dark) {
      .panel, .pill {
        --bg: #16191f; --bg-soft: #1f232b; --fg: #e8eaee; --muted: #9aa3b2; --border: #2c323c;
        --good: #4ade80; --good-bg: rgba(74,222,128,.14); --warn: #fbbf24; --warn-bg: rgba(251,191,36,.14);
        --bad: #f87171; --bad-bg: rgba(248,113,113,.14); --mute: #b3bac6; --mute-bg: rgba(179,186,198,.14);
      }
    }
    [hidden] { display: none !important; }
    .panel {
      position: fixed; top: 12px; right: 12px; bottom: 12px; width: min(380px, calc(100vw - 24px));
      display: flex; flex-direction: column; background: var(--bg); border: 1px solid var(--border);
      border-radius: 14px; box-shadow: 0 18px 50px rgba(0,0,0,.22); overflow: hidden;
    }
    header { display: flex; align-items: center; gap: 8px; padding: 10px 10px 10px 14px; border-bottom: 1px solid var(--border); }
    header strong { font-size: 15px; }
    .logo { display: inline-flex; }
    .spacer { flex: 1; }
    button { font: inherit; color: inherit; cursor: pointer; }
    button.icon { width: 30px; height: 30px; border: 0; border-radius: 8px; background: transparent; color: var(--muted); font-size: 15px; }
    button.icon:hover { background: var(--bg-soft); color: var(--fg); }
    button.primary { margin-top: 6px; padding: 8px 16px; border: 0; border-radius: 9px; background: var(--accent); color: #fff; font-weight: 600; }
    button.link { border: 0; background: none; padding: 0; color: var(--accent); font-size: 12.5px; font-weight: 600; }
    button.link:hover { text-decoration: underline; }
    .body { flex: 1; overflow-y: auto; padding: 14px; }
    .state { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 6px; padding: 40px 12px; }
    .title { font-weight: 650; font-size: 15px; margin: 0; }
    p { margin: 0; }
    .muted { color: var(--muted); }
    .small { font-size: 12.5px; }
    .note { margin: 10px 0 0; padding: 8px 10px; border-radius: 9px; background: var(--warn-bg); color: var(--fg); font-size: 12.5px; text-align: left; }
    .error { color: var(--bad); }
    .spinner { width: 34px; height: 34px; margin-bottom: 8px; border: 3px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin .9s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .score { display: flex; align-items: center; gap: 14px; }
    .big { min-width: 64px; height: 64px; padding: 0 8px; border-radius: 16px; display: grid; place-items: center; font-size: 28px; font-weight: 750; }
    .tone-good { color: var(--good); background: var(--good-bg); }
    .tone-warn { color: var(--warn); background: var(--warn-bg); }
    .tone-bad { color: var(--bad); background: var(--bad-bg); }
    .tone-muted { color: var(--mute); background: var(--mute-bg); }
    .tally { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
    .chip { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: 12px; font-weight: 650; white-space: nowrap; }
    .score + .tally + p, .tally + p, .score + p { margin-top: 10px; }
    .claims { display: flex; flex-direction: column; gap: 10px; margin-top: 12px; }
    .claim { padding: 12px; border: 1px solid var(--border); border-radius: 12px; background: var(--bg); }
    .claim.flash { animation: flash 1.4s ease-out; }
    @keyframes flash { from { box-shadow: 0 0 0 3px var(--accent); } to { box-shadow: 0 0 0 3px transparent; } }
    .row { display: flex; align-items: center; gap: 8px; }
    .claim-text { margin-top: 8px; font-weight: 600; }
    .reasoning { margin-top: 6px; color: var(--muted); }
    .caveats { margin: 6px 0 0; padding-left: 18px; color: var(--muted); font-size: 12.5px; }
    details { margin-top: 8px; }
    summary { cursor: pointer; color: var(--accent); font-size: 12.5px; font-weight: 600; }
    .source { margin-top: 8px; padding: 8px 10px; border-radius: 9px; background: var(--bg-soft); }
    .source a { color: var(--accent); font-weight: 600; text-decoration: none; word-break: break-all; }
    .source a:hover { text-decoration: underline; }
    .role { margin-right: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .03em; }
    .role.supports { color: var(--good); }
    .role.contradicts { color: var(--bad); }
    .pill {
      position: fixed; bottom: 16px; right: 16px; display: inline-flex; align-items: center; gap: 8px;
      padding: 8px 14px 8px 10px; border: 1px solid var(--border); border-radius: 999px; background: var(--bg);
      box-shadow: 0 8px 24px rgba(0,0,0,.18); font-weight: 650;
    }
  `;
})();
