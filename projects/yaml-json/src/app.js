import { parseYaml, stringifyYaml } from './index.js';

const byId = (id) => document.getElementById(id);
const sample = 'server:\n  host: 127.0.0.1\n  port: 8080\n  debug: true\n  tags:\n    - api\n    - web\nusers:\n  - name: Ada\n    role: admin\n';

function run(action) {
  byId('error').textContent = '';
  try { action(); }
  catch (error) { byId('error').textContent = error.message; }
}

byId('to-json').addEventListener('click', () => run(() => {
  byId('output').value = JSON.stringify(parseYaml(byId('source').value), null, 2);
}));
byId('to-yaml').addEventListener('click', () => run(() => {
  byId('output').value = stringifyYaml(JSON.parse(byId('source').value));
}));
byId('sample').addEventListener('click', () => {
  byId('source').value = sample;
  byId('to-json').click();
});
byId('clear').addEventListener('click', () => {
  byId('source').value = '';
  byId('output').value = '';
  byId('error').textContent = '';
});
byId('sample').click();
