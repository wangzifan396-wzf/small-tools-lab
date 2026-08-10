import { createMonotonicFactory, decodeUlid, generateUlid } from './index.js';

const byId = (id) => document.getElementById(id);
const monotonic = createMonotonicFactory();

function showError(message = '') { byId('error').textContent = message; }

function decode(value) {
  const decoded = decodeUlid(value);
  byId('canonical').textContent = decoded.ulid;
  byId('decoded-time').textContent = `${decoded.timestamp} · ${decoded.time.toISOString()}`;
  byId('randomness').textContent = decoded.randomnessHex;
}

byId('generate').addEventListener('click', () => {
  showError();
  try {
    const raw = byId('timestamp').value.trim();
    const value = byId('monotonic').checked
      ? monotonic(raw ? Number(raw) : Date.now())
      : generateUlid(raw ? Number(raw) : Date.now());
    byId('generated').textContent = value;
    byId('decode-input').value = value;
    decode(value);
  } catch (error) { showError(error.message); }
});

byId('decode').addEventListener('click', () => {
  showError();
  try { decode(byId('decode-input').value.trim()); }
  catch (error) { showError(error.message); }
});

byId('copy').addEventListener('click', async () => {
  const value = byId('generated').textContent;
  if (!value) return;
  try { await navigator.clipboard.writeText(value); byId('copy').textContent = '已复制'; setTimeout(() => { byId('copy').textContent = '复制'; }, 1200); }
  catch { showError('Clipboard access was denied by the browser.'); }
});

byId('generate').click();
