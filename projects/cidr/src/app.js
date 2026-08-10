import { calculateCidr, contains, overlaps, splitCidr } from './index.js';

const byId = (id) => document.getElementById(id);
const fields = [
  ['IP version', 'version'], ['Canonical CIDR', 'cidr'], ['Network', 'network'], ['Netmask', 'netmask'],
  ['Wildcard', 'wildcard'], ['Broadcast', 'broadcast'], ['First host', 'firstHost'], ['Last host', 'lastHost'],
  ['Last address', 'lastAddress'], ['Total addresses', 'totalAddresses'], ['Usable addresses', 'usableAddresses'],
];

function renderInfo(info) {
  const fragment = document.createDocumentFragment();
  for (const [label, key] of fields) {
    const item = document.createElement('div');
    const name = document.createElement('span'); name.textContent = label;
    const value = document.createElement('code');
    const raw = info[key]; value.textContent = raw === null ? '—' : typeof raw === 'bigint' ? raw.toLocaleString('en-US') : String(raw);
    item.append(name, value); fragment.append(item);
  }
  byId('results').replaceChildren(fragment);
}

byId('calculate').addEventListener('click', () => {
  byId('error').textContent = '';
  try { renderInfo(calculateCidr(byId('cidr').value.trim())); }
  catch (error) { byId('error').textContent = error.message; }
});

byId('relationship').addEventListener('click', () => {
  byId('relation-error').textContent = '';
  try {
    const left = byId('container').value.trim();
    const right = byId('candidate').value.trim();
    const contained = contains(left, right);
    const overlap = right.includes('/') ? overlaps(left, right) : null;
    byId('relation-result').textContent = overlap === null
      ? (contained ? '地址位于该网段内。' : '地址不在该网段内。')
      : `包含：${contained ? '是' : '否'} · 重叠：${overlap ? '是' : '否'}`;
  } catch (error) { byId('relation-error').textContent = error.message; }
});

byId('split').addEventListener('click', () => {
  byId('split-error').textContent = '';
  try { byId('split-output').value = splitCidr(byId('split-cidr').value.trim(), Number(byId('new-prefix').value)).join('\n'); }
  catch (error) { byId('split-error').textContent = error.message; }
});

byId('calculate').click();
byId('relationship').click();
