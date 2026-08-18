const C = window.CspStudio;
const $ = (id) => document.getElementById(id);
const e = {
  policy: $('policy'), audit: $('audit'), sample: $('sample'), generate: $('generate'),
  directives: $('directives'), errors: $('errors'), warnings: $('warnings'), findings: $('findings'),
  origin: $('origin'), type: $('type'), url: $('url'), simulate: $('simulate'), result: $('result'), effective: $('effective')
};
const SAMPLE = "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.example.com; style-src 'self' 'unsafe-inline'; img-src * data:; connect-src https:; object-src 'none'";
let parsed;

function run() {
  parsed = C.parse(e.policy.value);
  const audit = C.audit(parsed);
  e.directives.textContent = audit.summary.directives;
  e.errors.textContent = audit.summary.errors;
  e.warnings.textContent = audit.summary.warnings;
  e.findings.replaceChildren();
  audit.findings.forEach((finding) => {
    const row = document.createElement('div');
    row.className = `finding ${finding.severity}`;
    const title = document.createElement('strong');
    const detail = document.createElement('span');
    title.textContent = `${finding.severity.toUpperCase()} | ${finding.title}`;
    detail.textContent = finding.detail;
    row.append(title, detail);
    e.findings.append(row);
  });
  renderEffective();
}

function renderEffective() {
  e.effective.replaceChildren();
  ['script-src-elem', 'style-src-elem', 'img-src', 'connect-src', 'font-src', 'frame-src', 'worker-src'].forEach((name) => {
    const resolved = C.effective(parsed, name);
    const row = document.createElement('div');
    const label = document.createElement('b');
    const value = document.createElement('span');
    row.className = 'directive';
    label.textContent = name;
    value.textContent = resolved.directive ? `${resolved.directive}: ${resolved.sources.join(' ')}` : 'unrestricted';
    row.append(label, value);
    e.effective.append(row);
  });
}

e.audit.onclick = run;
e.sample.onclick = () => { e.policy.value = SAMPLE; run(); };
e.generate.onclick = () => { e.policy.value = C.generate({ nonce: 'RANDOM_PER_RESPONSE' }); run(); };
e.simulate.onclick = () => {
  try {
    const result = C.simulate(parsed || C.parse(e.policy.value), { origin: e.origin.value, url: e.url.value, type: e.type.value });
    e.result.className = result.allowed ? 'allowed' : 'blocked';
    e.result.textContent = `${result.allowed ? 'ALLOWED' : 'BLOCKED'} | ${result.reason} | ${result.effective.directive || 'no directive'}`;
  } catch (error) {
    e.result.className = 'blocked';
    e.result.textContent = error.message;
  }
};

e.policy.value = SAMPLE;
run();
