const H = window.HeaderSentinel;
const $ = (id) => document.getElementById(id);
const e = {
  url: $('url'), kind: $('kind'), sensitive: $('sensitive'), isolation: $('isolation'), current: $('current'), previous: $('previous'),
  audit: $('audit'), sample: $('sample'), baseline: $('baseline'), compare: $('compare'), markdown: $('markdown'), json: $('json'),
  status: $('status'), report: $('report'), score: $('score'), errors: $('errors'), warnings: $('warnings'), headers: $('headers'), isolated: $('isolated'),
  severity: $('severity'), query: $('query'), findings: $('findings'), readout: $('readout'), inventory: $('inventory')
};
const SAMPLE = [
  'HTTP/2 200', 'Strict-Transport-Security: max-age=300', 'X-Content-Type-Options: sniff',
  "Content-Security-Policy-Report-Only: default-src 'self'", 'Referrer-Policy: unsafe-url',
  'Permissions-Policy: camera=*', 'Access-Control-Allow-Origin: *', 'Access-Control-Allow-Credentials: true',
  'Cache-Control: public, max-age=300', 'Set-Cookie: sid=demo', 'Server: Example/1.0', 'X-Powered-By: Demo'
].join('\n');
let report = null;

function options() { return { url: e.url.value, kind: e.kind.value, sensitive: e.sensitive.checked, isolation: e.isolation.checked }; }
function setStatus(message, bad = false) { e.status.textContent = message; e.status.className = bad ? 'error' : ''; }
function download(name, data, type) { const url = URL.createObjectURL(new Blob([data], { type })); const link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function audit() {
  report = H.auditHeaders(e.current.value, options());
  setStatus(`${report.summary.headers} headers audited.`);
  render();
}
function compare() {
  if (!e.previous.value.trim()) { setStatus('Paste a previous snapshot before comparing.', true); return; }
  const diff = H.compareHeaders(e.previous.value, e.current.value, options());
  report = diff.after;
  report.findings = report.findings.concat(diff.changes).sort((a, b) => ({ error: 0, warning: 1, info: 2 })[a.severity] - ({ error: 0, warning: 1, info: 2 })[b.severity]);
  report.comparison = diff;
  setStatus(`${diff.changes.length} release changes found; score delta ${diff.summary.scoreDelta >= 0 ? '+' : ''}${diff.summary.scoreDelta}.`);
  render();
}
function render() {
  if (!report) return;
  const s = report.summary;
  e.report.hidden = false; e.score.textContent = `${s.score}/100`; e.errors.textContent = s.errors; e.warnings.textContent = s.warnings; e.headers.textContent = s.headers; e.isolated.textContent = s.crossOriginIsolated ? 'Yes' : 'No';
  renderFindings();
  e.readout.replaceChildren();
  const gate = s.errors === 0 ? 'PASS' : 'FAIL';
  const rows = [['Release gate', gate, gate === 'PASS' ? 'good' : 'bad'], ['Context', `${e.kind.value}${e.sensitive.checked ? ' · sensitive' : ''}`, ''], ['Score', `${s.score}/100`, ''], ['Cross-origin isolation', s.crossOriginIsolated ? 'ready' : 'not active', s.crossOriginIsolated ? 'good' : '']];
  if (report.comparison) rows.push(['Score change', `${report.comparison.summary.scoreDelta >= 0 ? '+' : ''}${report.comparison.summary.scoreDelta}`, report.comparison.summary.scoreDelta < 0 ? 'bad' : 'good']);
  rows.forEach(([label, value, kind]) => { const row = document.createElement('div'); row.className = `readout ${kind}`; const b = document.createElement('b'); const span = document.createElement('span'); b.textContent = label; span.textContent = value; row.append(b, span); e.readout.append(row); });
  e.inventory.replaceChildren();
  report.parsed.headers.forEach((values, name) => { const row = document.createElement('div'); row.className = 'header-row'; const b = document.createElement('b'); const span = document.createElement('span'); b.textContent = name; span.textContent = values.length > 1 ? `${values.length} values` : values[0] || '(empty)'; row.append(b, span); e.inventory.append(row); });
}
function renderFindings() {
  const items = H.filterFindings(report.findings, { severity: e.severity.value, query: e.query.value });
  e.findings.replaceChildren();
  if (!items.length) { const empty = document.createElement('p'); empty.textContent = 'No findings match this filter.'; e.findings.append(empty); return; }
  items.forEach((item) => { const row = document.createElement('div'); row.className = `finding ${item.severity}`; const title = document.createElement('b'); const detail = document.createElement('span'); title.textContent = `${item.severity.toUpperCase()} | ${item.message}`; detail.textContent = `${item.code} @ ${item.header}${item.remediation ? ` · ${item.remediation}` : ''}`; row.append(title, detail); e.findings.append(row); });
}

e.audit.onclick = audit;
e.sample.onclick = () => { e.current.value = SAMPLE; e.sensitive.checked = true; audit(); };
e.baseline.onclick = () => { e.current.value = H.generateBaseline(options()); audit(); };
e.compare.onclick = compare;
e.markdown.onclick = () => { if (report) download('header-sentinel.md', H.formatMarkdown(report), 'text/markdown'); };
e.json.onclick = () => { if (report) download('header-sentinel.json', JSON.stringify({ summary: report.summary, findings: report.findings }, null, 2), 'application/json'); };
[e.severity, e.query].forEach((input) => { input.oninput = renderFindings; });
e.sample.click();
