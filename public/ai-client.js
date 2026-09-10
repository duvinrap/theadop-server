function isFileProtocol() {
  try { return location.protocol === 'file:'; } catch (_) { return false; }
}

function getAdopApiBase() {
  // Priority 1: address the user saved on THIS phone via the in-app "AI Server" page.
  try {
    const stored = localStorage.getItem('adop_api_base');
    if (stored) return stored;
  } catch (_) {}
  // Priority 2: native Android default (only correct inside the emulator).
  try {
    if (window.AdopAndroid && typeof window.AdopAndroid.getApiBase === 'function') return window.AdopAndroid.getApiBase();
  } catch (_) {}
  // Priority 3: running as a normal website (e.g. the Vercel deployment) — call the
  // same origin's /api/* routes directly, no configuration needed.
  return '';
}

async function theAdopAI(tool, prompt) {
  const base = getAdopApiBase().replace(/\/$/, '');
  if (!base && isFileProtocol()) {
    throw new Error('AI server address not set. Open "⚙ AI Server" in the menu and enter your server address first.');
  }
  const url = `${base}/api/ai`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({tool, prompt}),
      signal: controller.signal
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('The AI server did not respond within 30 seconds. Check the server address and that server.js is running.');
    }
    throw new Error(`Cannot reach the AI server at ${base}. Check the address in "⚙ AI Server", your internet/Wi-Fi, and that server.js is running.`);
  } finally {
    clearTimeout(timeoutId);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `AI request failed (${response.status})`);
  return data.text || 'No AI response.';
}
