import { classifyEntropy, estimateEntropy, generatePasswords } from './index.js';

const byId = (id) => document.getElementById(id);
const labels = { weak: '弱', fair: '一般', strong: '强', 'very-strong': '很强' };

function options() {
  return {
    length: Number(byId('length').value),
    lowercase: byId('lowercase').checked,
    uppercase: byId('uppercase').checked,
    digits: byId('digits').checked,
    symbols: byId('symbols').checked,
    excludeAmbiguous: byId('ambiguous').checked,
  };
}

function generate() {
  const list = byId('results');
  list.replaceChildren();
  byId('error').textContent = '';
  try {
    const settings = options();
    const passwords = generatePasswords(Number(byId('count').value), settings);
    const bits = estimateEntropy(settings.length, settings);
    for (const password of passwords) {
      const row = document.createElement('div');
      row.className = 'password';
      const value = document.createElement('code');
      value.textContent = password;
      const strength = document.createElement('span');
      strength.textContent = `≈ ${bits.toFixed(1)} bits · ${labels[classifyEntropy(bits)]}`;
      row.append(value, strength);
      list.append(row);
    }
  } catch (error) { byId('error').textContent = error.message; }
}

byId('generate').addEventListener('click', generate);
byId('copy').addEventListener('click', async () => {
  const values = [...document.querySelectorAll('.password code')].map((node) => node.textContent);
  if (!values.length) return;
  try {
    await navigator.clipboard.writeText(values.join('\n'));
    byId('copy').textContent = '已复制';
    setTimeout(() => { byId('copy').textContent = '复制全部'; }, 1200);
  } catch { byId('error').textContent = 'Clipboard access was denied by the browser.'; }
});
generate();
