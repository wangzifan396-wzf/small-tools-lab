"use strict";

const path = require("node:path");

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

function ansi(enabled, code, value) { return enabled ? `\u001b[${code}m${value}\u001b[0m` : value; }

function renderPretty(report, options) {
  const color = Boolean(options && options.color);
  const gradeColor = report.score >= 85 ? "32" : report.score >= 70 ? "33" : "31";
  const severityColor = { high: "31", medium: "33", low: "36", info: "90" };
  const width = 72;
  const lines = [];
  lines.push(ansi(color, "1", "HarnessLint"));
  lines.push("=".repeat(width));
  lines.push(`Grade ${ansi(color, `${gradeColor};1`, report.grade)}  Score ${ansi(color, gradeColor, `${report.score}/100`)}  Files ${report.filesScanned}  Context ~${report.estimatedTokens.toLocaleString()} tokens`);
  lines.push(`High ${report.counts.high}  Medium ${report.counts.medium}  Low ${report.counts.low}`);
  lines.push("");
  if (!report.findings.length) lines.push(ansi(color, "32", "No findings. The harness passed every enabled check."));
  for (const item of report.findings) {
    const baseline = item.baseline ? ansi(color, "90", " [baseline]") : "";
    lines.push(`${ansi(color, `${severityColor[item.severity]};1`, item.severity.toUpperCase().padEnd(6))} ${ansi(color, "1", item.rule)} ${item.message}${baseline}`);
    lines.push(`       ${item.file}:${item.line}:${item.column}`);
    if (item.evidence) lines.push(`       > ${item.evidence.replace(/\s+/g, " ").slice(0, 120)}`);
    lines.push(`       Fix: ${item.suggestion}`);
    lines.push("");
  }
  const active = report.newFindings || report.findings;
  lines.push("-".repeat(width));
  lines.push(`${active.length} new finding${active.length === 1 ? "" : "s"}; ${report.findings.length - active.length} baselined.`);
  return `${lines.join("\n")}\n`;
}

function cleanReport(report) {
  return {
    tool: report.tool,
    version: report.version,
    scannedAt: report.scannedAt,
    repository: path.basename(report.root),
    filesScanned: report.filesScanned,
    contextBytes: report.contextBytes,
    estimatedTokens: report.estimatedTokens,
    score: report.score,
    grade: report.grade,
    counts: report.counts,
    findings: report.findings
  };
}

function renderJson(report) { return `${JSON.stringify(cleanReport(report), null, 2)}\n`; }

function renderSarif(report) {
  const severity = { high: "error", medium: "warning", low: "note", info: "none" };
  const rules = Object.entries(report.rules).map(([id, rule]) => ({
    id,
    name: rule.title.replace(/[^A-Za-z0-9]+/g, ""),
    shortDescription: { text: rule.title },
    fullDescription: { text: `${rule.title} (${rule.category})` },
    defaultConfiguration: { level: severity[rule.severity] }
  }));
  const results = report.findings.map((item) => ({
    ruleId: item.rule,
    level: severity[item.severity],
    message: { text: `${item.message} ${item.suggestion}` },
    locations: item.file === "." ? [] : [{
      physicalLocation: {
        artifactLocation: { uri: item.file.replaceAll("\\", "/"), uriBaseId: "%SRCROOT%" },
        region: { startLine: item.line, startColumn: item.column }
      }
    }],
    partialFingerprints: { primaryLocationLineHash: item.fingerprint },
    baselineState: item.baseline ? "unchanged" : "new"
  }));
  return `${JSON.stringify({
    version: "2.1.0",
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    runs: [{ tool: { driver: { name: "HarnessLint", version: report.version, informationUri: "https://github.com/wangzifan396-wzf/harnesslint", rules } }, results }]
  }, null, 2)}\n`;
}

function findingRow(item) {
  return `<article class="finding" data-severity="${escapeHtml(item.severity)}" data-category="${escapeHtml(item.category)}" data-search="${escapeHtml(`${item.rule} ${item.file} ${item.message} ${item.evidence}`.toLowerCase())}">
    <div class="severity severity-${escapeHtml(item.severity)}">${escapeHtml(item.severity)}</div>
    <div class="finding-main">
      <div class="finding-title"><code>${escapeHtml(item.rule)}</code><strong>${escapeHtml(item.message)}</strong>${item.baseline ? '<span class="baseline">baseline</span>' : ""}</div>
      <a class="location" href="#">${escapeHtml(item.file)}:${item.line}:${item.column}</a>
      ${item.evidence ? `<pre>${escapeHtml(item.evidence)}</pre>` : ""}
      <p><span>Fix</span>${escapeHtml(item.suggestion)}</p>
    </div>
  </article>`;
}

function renderHtml(report) {
  const data = cleanReport(report);
  const repository = escapeHtml(data.repository);
  const findings = report.findings.map(findingRow).join("");
  const categories = Object.entries(report.findings.reduce((result, item) => { result[item.category] = (result[item.category] || 0) + 1; return result; }, {})).sort((a, b) => b[1] - a[1]);
  const maxCategory = Math.max(1, ...categories.map((item) => item[1]));
  const categoryBars = categories.length ? categories.map(([name, count], index) => `<div class="category-row"><span>${escapeHtml(name)}</span><i><b style="width:${(count / maxCategory) * 100}%;--bar:${["#d85f4b", "#e0b247", "#3f8c79", "#697fb4"][index % 4]}"></b></i><strong>${count}</strong></div>`).join("") : '<div class="empty-chart">No findings</div>';
  const generated = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(report.scannedAt));

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HarnessLint - ${repository}</title>
<style>
:root{color-scheme:light;--page:#f4f6f3;--surface:#fff;--ink:#17201f;--muted:#68736f;--line:#ccd6d1;--green:#317d69;--yellow:#e0b247;--coral:#d85f4b;--blue:#557cab;font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}*{box-sizing:border-box}body{margin:0;background:var(--page);color:var(--ink);font-size:14px;line-height:1.5}.topbar{display:flex;height:58px;align-items:center;justify-content:space-between;padding:0 max(4vw,calc((100vw - 1420px)/2));border-bottom:1px solid var(--line);background:var(--surface)}.brand{display:flex;align-items:center;gap:10px;font-weight:800}.brand-mark{display:grid;width:29px;height:29px;place-items:center;border-radius:5px;background:var(--ink);color:#fff;font-family:ui-monospace,monospace;font-size:11px}.topbar span:last-child{color:var(--muted);font-family:ui-monospace,monospace;font-size:10px}main{padding:36px max(4vw,calc((100vw - 1420px)/2)) 60px}.heading{display:flex;align-items:end;justify-content:space-between;gap:24px;margin-bottom:26px}.eyebrow{color:var(--green);font-family:ui-monospace,monospace;font-size:10px;font-weight:800}.heading h1{margin:4px 0 0;font-size:28px;letter-spacing:0}.grade{display:flex;align-items:center;gap:12px}.grade strong{display:grid;width:62px;height:62px;place-items:center;border:1px solid var(--ink);border-radius:50%;font-size:28px}.grade span{display:grid;color:var(--muted);font-size:10px;text-transform:uppercase}.grade b{color:var(--ink);font-family:ui-monospace,monospace;font-size:14px}.summary{display:grid;grid-template-columns:repeat(4,1fr);overflow:hidden;border:1px solid var(--line);border-radius:6px;background:var(--surface)}.summary div{display:grid;gap:4px;padding:16px 18px;border-right:1px solid var(--line)}.summary div:last-child{border:0}.summary span{color:var(--muted);font-size:9px;font-weight:800;text-transform:uppercase}.summary strong{font-family:ui-monospace,monospace;font-size:22px}.dashboard{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:18px}.panel{padding:20px;border:1px solid var(--line);border-radius:6px;background:var(--surface)}.panel h2{margin:0 0 16px;font-size:15px}.severity-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.severity-grid div{padding:14px;border-radius:5px;background:var(--page)}.severity-grid span{display:block;color:var(--muted);font-size:9px;font-weight:800;text-transform:uppercase}.severity-grid strong{font-family:ui-monospace,monospace;font-size:24px}.severity-grid .high strong{color:var(--coral)}.severity-grid .medium strong{color:#a9790b}.severity-grid .low strong{color:var(--blue)}.category-row{display:grid;align-items:center;grid-template-columns:100px 1fr 25px;gap:9px;margin:9px 0}.category-row span{overflow:hidden;color:var(--muted);font-size:10px;text-overflow:ellipsis}.category-row i{height:7px;overflow:hidden;border-radius:3px;background:var(--page)}.category-row b{display:block;height:100%;border-radius:3px;background:var(--bar)}.category-row strong{font-family:ui-monospace,monospace;font-size:10px;text-align:right}.filters{display:grid;grid-template-columns:1fr auto;gap:10px;margin:28px 0 12px}.filters input{height:40px;padding:8px 11px;border:1px solid var(--line);border-radius:5px;background:var(--surface);color:var(--ink);font:inherit}.filter-buttons{display:flex;gap:5px}.filter-buttons button{min-width:72px;border:1px solid var(--line);border-radius:5px;background:var(--surface);color:var(--muted);font-weight:700;cursor:pointer}.filter-buttons button[aria-pressed=true]{border-color:var(--ink);background:var(--ink);color:#fff}.findings{display:grid;gap:8px}.finding{display:grid;grid-template-columns:82px minmax(0,1fr);overflow:hidden;border:1px solid var(--line);border-radius:6px;background:var(--surface)}.severity{display:grid;align-items:start;padding:16px 12px;color:#fff;font-family:ui-monospace,monospace;font-size:10px;font-weight:800;text-align:center;text-transform:uppercase}.severity-high{background:var(--coral)}.severity-medium{background:#ad7e17}.severity-low{background:var(--blue)}.severity-info{background:var(--muted)}.finding-main{min-width:0;padding:14px 16px}.finding-title{display:flex;align-items:center;gap:9px}.finding-title code{padding:2px 5px;border-radius:3px;background:var(--page);font-size:10px}.finding-title strong{font-size:13px}.baseline{padding:2px 5px;border-radius:3px;background:#e5e9e6;color:var(--muted);font-size:8px;text-transform:uppercase}.location{display:inline-block;margin-top:4px;color:var(--green);font-family:ui-monospace,monospace;font-size:10px;text-decoration:none}.finding pre{overflow-x:auto;margin:10px 0 0;padding:9px;border-radius:4px;background:#17201f;color:#dce7e2;font-size:10px;white-space:pre-wrap}.finding p{display:flex;gap:8px;margin:10px 0 0;color:var(--muted);font-size:11px}.finding p span{color:var(--green);font-weight:800;text-transform:uppercase}.empty{display:grid;min-height:180px;place-items:center;border:1px dashed var(--line);border-radius:6px;color:var(--muted);font-family:ui-monospace,monospace;font-size:11px;text-transform:uppercase}.finding[hidden]{display:none}@media(max-width:700px){.topbar{padding:0 14px}.topbar span:last-child{display:none}main{padding:26px 14px}.heading{align-items:start}.summary{grid-template-columns:repeat(2,1fr)}.summary div:nth-child(2){border-right:0}.summary div:nth-child(-n+2){border-bottom:1px solid var(--line)}.dashboard{grid-template-columns:1fr}.filters{grid-template-columns:1fr}.filter-buttons{overflow-x:auto}.finding{grid-template-columns:1fr}.severity{padding:6px}.finding-title{align-items:flex-start;flex-wrap:wrap}.grade strong{width:52px;height:52px}}
</style></head><body>
<header class="topbar"><div class="brand"><span class="brand-mark">HL</span>HarnessLint</div><span>Generated ${escapeHtml(generated)}</span></header>
<main><div class="heading"><div><span class="eyebrow">HARNESS AUDIT / ${escapeHtml(report.version)}</span><h1>${repository}</h1></div><div class="grade"><strong>${escapeHtml(report.grade)}</strong><span>Readiness score<b>${report.score} / 100</b></span></div></div>
<section class="summary"><div><span>Harness files</span><strong>${report.filesScanned}</strong></div><div><span>Estimated tokens</span><strong>${report.estimatedTokens.toLocaleString()}</strong></div><div><span>Total findings</span><strong>${report.findings.length}</strong></div><div><span>New findings</span><strong>${(report.newFindings || report.findings).length}</strong></div></section>
<div class="dashboard"><section class="panel"><h2>Severity</h2><div class="severity-grid"><div class="high"><span>High</span><strong>${report.counts.high}</strong></div><div class="medium"><span>Medium</span><strong>${report.counts.medium}</strong></div><div class="low"><span>Low</span><strong>${report.counts.low}</strong></div></div></section><section class="panel"><h2>Categories</h2>${categoryBars}</section></div>
<div class="filters"><input id="search" type="search" placeholder="Filter by rule, file, or message" aria-label="Filter findings"><div class="filter-buttons" role="group" aria-label="Severity filter"><button type="button" data-filter="all" aria-pressed="true">All</button><button type="button" data-filter="high" aria-pressed="false">High</button><button type="button" data-filter="medium" aria-pressed="false">Medium</button><button type="button" data-filter="low" aria-pressed="false">Low</button></div></div>
<section class="findings" id="findings">${findings || '<div class="empty">No findings</div>'}</section></main>
<script>const search=document.querySelector('#search');let severity='all';function filter(){const query=search.value.trim().toLowerCase();document.querySelectorAll('.finding').forEach(item=>{item.hidden=(severity!=='all'&&item.dataset.severity!==severity)||(query&&!item.dataset.search.includes(query))})}search.addEventListener('input',filter);document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{severity=button.dataset.filter;document.querySelectorAll('[data-filter]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));filter()}));</script>
</body></html>`;
}

module.exports = { escapeHtml, renderHtml, renderJson, renderPretty, renderSarif };
