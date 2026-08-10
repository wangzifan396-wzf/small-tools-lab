import { convertCurl } from './index.js';

const byId = (id) => document.getElementById(id);
let conversion = null;

function showTarget() {
  if (!conversion) return;
  byId('output').value = byId('target').value === 'fetch' ? conversion.fetch : conversion.python;
}

byId('convert').addEventListener('click', () => {
  byId('error').textContent = '';
  byId('warnings').replaceChildren();
  try {
    conversion = convertCurl(byId('input').value);
    for (const warning of conversion.request.warnings) {
      const item = document.createElement('li');
      item.textContent = warning;
      byId('warnings').append(item);
    }
    showTarget();
  } catch (error) {
    conversion = null;
    byId('output').value = '';
    byId('error').textContent = error.message;
  }
});

byId('target').addEventListener('change', showTarget);
byId('sample').addEventListener('click', () => {
  byId('input').value = "curl -L 'https://api.example.com/users?active=true' -H 'Accept: application/json' -H 'Authorization: Bearer $TOKEN' --max-time 10";
  byId('convert').click();
});
byId('copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(byId('output').value);
    byId('copy').textContent = '已复制';
    setTimeout(() => { byId('copy').textContent = '复制输出'; }, 1200);
  } catch { byId('error').textContent = 'Clipboard access was denied by the browser.'; }
});
byId('sample').click();
