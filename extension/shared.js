// Settings shared by the background worker (importScripts) and the popup (<script>).

const VERIQUE_DEFAULTS = Object.freeze({
  apiBase: 'http://localhost:8000', // FastAPI backend
  appUrl: 'http://localhost:3000', // Next.js web app, for the "Open Verique" link
});

// The API rejects text outside these bounds (VerifyRequest.text in backend/app/schemas/verification.py).
const VERIQUE_MIN_CHARS = 10;
const VERIQUE_MAX_CHARS = 50000;

/** "http://host:port/path/" -> "http://host:port/path"; returns null for anything that isn't http(s). */
function normalizeBaseUrl(value) {
  try {
    const url = new URL(String(value).trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return (url.origin + url.pathname).replace(/\/+$/, '');
  } catch {
    return null;
  }
}

async function getVeriqueSettings() {
  const stored = await chrome.storage.sync.get(VERIQUE_DEFAULTS);
  return {
    apiBase: normalizeBaseUrl(stored.apiBase) || VERIQUE_DEFAULTS.apiBase,
    appUrl: normalizeBaseUrl(stored.appUrl) || VERIQUE_DEFAULTS.appUrl,
  };
}
