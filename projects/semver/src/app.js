import { isValidVersion, satisfies, sortVersions } from './index.js';

const byId = (id) => document.getElementById(id);
const lines = () => byId('versions').value.split(/\r?\n/u).map((value) => value.trim()).filter(Boolean);
const show = (message, ok) => {
  byId('status').textContent = message;
  byId('status').dataset.state = ok ? 'ok' : 'error';
};

byId('validate').addEventListener('click', () => {
  const invalid = lines().filter((version) => !isValidVersion(version));
  show(invalid.length ? `Invalid: ${invalid.join(', ')}` : 'All versions are valid SemVer 2.0.', invalid.length === 0);
});
byId('sort').addEventListener('click', () => {
  const versions = lines();
  const invalid = versions.filter((version) => !isValidVersion(version));
  if (invalid.length) { show(`Cannot sort invalid versions: ${invalid.join(', ')}`, false); return; }
  byId('versions').value = sortVersions(versions).join('\n');
  show('Sorted by SemVer precedence (build metadata is ignored).', true);
});
byId('check').addEventListener('click', () => {
  try {
    const result = satisfies(byId('candidate').value.trim(), byId('range').value.trim());
    show(result ? 'The version satisfies this range.' : 'The version does not satisfy this range.', result);
  } catch (error) { show(error.message, false); }
});
byId('validate').click();
