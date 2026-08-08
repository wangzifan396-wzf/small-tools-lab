import { buildQuery, parseQuery, rebuildUrl } from './index.js';

const byId = (id) => document.getElementById(id);
let parsed = parseQuery(byId('input').value);

function collect() {
  return [...byId('pairs').querySelectorAll('.pair')].map((row) => ({
    key: row.querySelector('.key').value,
    value: row.querySelector('.value').value,
    hasEquals: row.querySelector('.equals').checked,
  }));
}

function rebuild() {
  const pairs = collect();
  const options = { spaceAsPlus: byId('plus').checked };
  byId('query-output').textContent = buildQuery(pairs, options) || '(empty query)';
  byId('url-output').textContent = rebuildUrl(parsed, pairs, options);
}

function rowFor(pair) {
  const row = document.createElement('div');
  row.className = 'pair';
  const key = document.createElement('input');
  key.className = 'key'; key.placeholder = 'key'; key.value = pair.key;
  const value = document.createElement('input');
  value.className = 'value'; value.placeholder = 'value'; value.value = pair.value;
  const label = document.createElement('label');
  const equals = document.createElement('input');
  equals.type = 'checkbox'; equals.className = 'equals'; equals.checked = pair.hasEquals;
  label.append(equals, document.createTextNode(' ='));
  const remove = document.createElement('button');
  remove.type = 'button'; remove.className = 'danger'; remove.textContent = '删除';
  for (const control of [key, value, equals]) control.addEventListener('input', rebuild);
  remove.addEventListener('click', () => { row.remove(); rebuild(); });
  row.append(key, value, label, remove);
  return row;
}

function render() {
  byId('pairs').replaceChildren(...parsed.pairs.map(rowFor));
  rebuild();
}

byId('parse').addEventListener('click', () => {
  byId('error').textContent = '';
  try {
    parsed = parseQuery(byId('input').value, { plusAsSpace: byId('plus').checked });
    render();
  } catch (error) { byId('error').textContent = error.message; }
});
byId('add').addEventListener('click', () => { byId('pairs').append(rowFor({ key: '', value: '', hasEquals: true })); rebuild(); });
byId('clear').addEventListener('click', () => { byId('pairs').replaceChildren(); rebuild(); });
byId('plus').addEventListener('change', () => byId('parse').click());
byId('copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(buildQuery(collect(), { spaceAsPlus: byId('plus').checked })); }
  catch { byId('error').textContent = 'Clipboard access was denied by the browser.'; }
});
render();
