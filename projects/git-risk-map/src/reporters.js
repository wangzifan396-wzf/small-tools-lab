"use strict";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

function ansi(enabled, code, value) { return enabled ? `\u001b[${code}m${value}\u001b[0m` : value; }
function signed(value) { return value > 0 ? `+${value}` : String(value); }
function compact(value, length) { return value.length <= length ? value : `${value.slice(0, Math.max(1, length - 3))}...`; }

function renderPretty(report, options) {
  const color = Boolean(options && options.color);
  const levelColor = { critical: "31", high: "33", medium: "36", low: "32" };
  const lines = [ansi(color, "1", "Git Risk Map"), "=".repeat(78)];
  lines.push(`${report.comparison}  |  history ${report.historyDays} days`);
  lines.push(`Risk ${ansi(color, `${levelColor[report.overall.level]};1`, report.overall.level.toUpperCase())} ${report.overall.score}/100  |  ${report.summary.files} files  |  +${report.summary.additions} -${report.summary.deletions}  |  test ratio ${report.summary.testChangeRatio ?? "n/a"}`);
  lines.push("");
  if (!report.files.length) lines.push(ansi(color, "32", "No changed files found for this comparison."));
  else {
    lines.push(" #  RISK       SCORE  CHANGE       FILE");
    lines.push("-".repeat(78));
    report.files.forEach((file, index) => {
      const level = file.level.toUpperCase().padEnd(8);
      const change = `+${file.additions}/-${file.deletions}`.padEnd(12);
      lines.push(`${String(index + 1).padStart(2)}  ${ansi(color, levelColor[file.level], level)} ${String(file.score).padStart(3)}    ${change} ${compact(file.file, 42)}`);
      const top = file.signals.filter((signal) => signal.points > 0).slice(0, 3).map((signal) => `${signal.label} ${signed(signal.points)}`).join("; ");
      if (top) lines.push(`             ${ansi(color, "90", top)}`);
    });
  }
  lines.push("", "Review plan");
  report.reviewPlan.forEach((group, index) => lines.push(`${index + 1}. ${group.title}: ${group.files.join(", ")}`));
  lines.push("", "Recommendations");
  report.recommendations.forEach((item) => lines.push(`- ${item}`));
  return `${lines.join("\n")}\n`;
}

function cleanReport(report) {
  return {
    tool: report.tool, version: report.version, generatedAt: report.generatedAt, repository: report.repository,
    comparison: report.comparison, historyDays: report.historyDays, overall: report.overall, summary: report.summary,
    files: report.files, reviewPlan: report.reviewPlan, recommendations: report.recommendations
  };
}

function renderJson(report) { return `${JSON.stringify(cleanReport(report), null, 2)}\n`; }

function renderMarkdown(report) {
  const lines = ["## Git Risk Map", "", `**${report.overall.level.toUpperCase()} ${report.overall.score}/100** for \`${report.comparison}\``, "", `Changed files: ${report.summary.files} | Lines: +${report.summary.additions} / -${report.summary.deletions} | Test change ratio: ${report.summary.testChangeRatio ?? "n/a"}`, "", "| # | Risk | Score | Change | File | Main signals |", "| ---: | --- | ---: | ---: | --- | --- |"];
  report.files.forEach((file, index) => {
    const signals = file.signals.filter((signal) => signal.points > 0).slice(0, 3).map((signal) => `${signal.label} (${signed(signal.points)})`).join(", ");
    lines.push(`| ${index + 1} | ${file.level} | ${file.score} | +${file.additions} / -${file.deletions} | \`${file.file.replaceAll("|", "\\|")}\` | ${signals.replaceAll("|", "\\|")} |`);
  });
  if (!report.files.length) lines.push("| - | low | 0 | 0 | No changed files | - |");
  lines.push("", "### Review plan", "");
  report.reviewPlan.forEach((group, index) => lines.push(`${index + 1}. **${group.title}:** ${group.files.map((file) => `\`${file}\``).join(", ")}`));
  lines.push("", "### Recommendations", "");
  report.recommendations.forEach((item) => lines.push(`- ${item}`));
  return `${lines.join("\n")}\n`;
}

function fileCard(file, index) {
  const signals = file.signals.map((signal) => `<li class="${signal.points < 0 ? "reduces" : ""}"><span>${escapeHtml(signal.label)}</span><strong>${escapeHtml(signed(signal.points))}</strong><small>${escapeHtml(signal.detail)}</small></li>`).join("");
  return `<article class="file-card" data-level="${escapeHtml(file.level)}" data-search="${escapeHtml(`${file.file} ${file.tags.join(" ")} ${file.signals.map((item) => item.label).join(" ")}`.toLowerCase())}">
    <div class="rank">${index + 1}</div><div class="file-main"><div class="file-heading"><div><span class="level level-${escapeHtml(file.level)}">${escapeHtml(file.level)}</span><code>${escapeHtml(file.status)}</code><h3>${escapeHtml(file.file)}</h3></div><div class="score"><strong>${file.score}</strong><span>/ 100</span></div></div>
    <div class="metrics"><span><b>+${file.additions}</b> added</span><span><b>-${file.deletions}</b> removed</span><span><b>${file.history.commits}</b> commits / ${escapeHtml(String(file.history.authors))} authors</span><span>${file.tags.map((tag) => `<i>${escapeHtml(tag)}</i>`).join("")}</span></div><ul>${signals}</ul></div></article>`;
}

function renderHtml(report) {
  const cards = report.files.map(fileCard).join("") || '<div class="empty">No changed files found</div>';
  const maxScore = Math.max(1, ...report.files.map((file) => file.score));
  const bars = report.files.slice(0, 8).map((file) => `<div class="bar"><span>${escapeHtml(file.file)}</span><i><b style="width:${(file.score / maxScore) * 100}%"></b></i><strong>${file.score}</strong></div>`).join("") || '<div class="empty-chart">Clean comparison</div>';
  const generated = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(report.generatedAt));
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Git Risk Map - ${escapeHtml(report.repository)}</title><style>
:root{color-scheme:light;--page:#f5f6f4;--surface:#fff;--ink:#18201e;--muted:#65716d;--line:#ccd5d1;--green:#26745f;--lime:#b9cc4a;--yellow:#d5a92e;--coral:#d85d4b;--blue:#5079a9;font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}*{box-sizing:border-box}body{margin:0;background:var(--page);color:var(--ink);font-size:14px;line-height:1.45}.topbar{display:flex;height:58px;align-items:center;justify-content:space-between;padding:0 max(4vw,calc((100vw - 1380px)/2));border-bottom:1px solid var(--line);background:var(--surface)}.brand{display:flex;align-items:center;gap:10px;font-weight:800}.mark{display:grid;width:30px;height:30px;place-items:center;border-radius:5px;background:var(--ink);color:var(--lime);font:800 10px ui-monospace,monospace}.topbar>span{color:var(--muted);font:10px ui-monospace,monospace}main{padding:34px max(4vw,calc((100vw - 1380px)/2)) 60px}.heading{display:flex;align-items:end;justify-content:space-between;gap:20px}.eyebrow{color:var(--green);font:800 10px ui-monospace,monospace;text-transform:uppercase}.heading h1{margin:5px 0 2px;font-size:29px;letter-spacing:0}.heading p{margin:0;color:var(--muted);font:11px ui-monospace,monospace}.overall{display:flex;align-items:center;gap:12px}.dial{display:grid;width:68px;height:68px;place-items:center;border:7px solid var(--coral);border-radius:50%;font:800 23px ui-monospace,monospace}.overall div:last-child{display:grid}.overall span{color:var(--muted);font-size:9px;font-weight:800;text-transform:uppercase}.overall strong{text-transform:uppercase}.summary{display:grid;grid-template-columns:repeat(5,1fr);overflow:hidden;margin-top:24px;border:1px solid var(--line);border-radius:6px;background:var(--surface)}.summary div{padding:15px 17px;border-right:1px solid var(--line)}.summary div:last-child{border:0}.summary span{display:block;color:var(--muted);font-size:9px;font-weight:800;text-transform:uppercase}.summary strong{font:800 21px ui-monospace,monospace}.dashboard{display:grid;grid-template-columns:1.1fr .9fr;gap:16px;margin:16px 0}.panel{padding:19px;border:1px solid var(--line);border-radius:6px;background:var(--surface)}.panel h2{margin:0 0 13px;font-size:14px}.bar{display:grid;grid-template-columns:minmax(80px,150px) 1fr 24px;align-items:center;gap:8px;margin:8px 0}.bar span{overflow:hidden;color:var(--muted);font:9px ui-monospace,monospace;text-overflow:ellipsis;white-space:nowrap}.bar i{height:7px;overflow:hidden;border-radius:3px;background:var(--page)}.bar b{display:block;height:100%;border-radius:3px;background:var(--coral)}.bar strong{font:9px ui-monospace,monospace;text-align:right}.plan{display:grid;gap:8px}.plan div{display:grid;grid-template-columns:22px 1fr;gap:8px}.plan b{display:grid;width:22px;height:22px;place-items:center;border-radius:4px;background:var(--ink);color:#fff;font:9px ui-monospace,monospace}.plan span{font-size:11px}.plan small{display:block;color:var(--muted)}.filters{display:grid;grid-template-columns:1fr auto;gap:8px;margin:26px 0 11px}.filters input{height:40px;padding:8px 11px;border:1px solid var(--line);border-radius:5px;background:var(--surface);font:inherit}.buttons{display:flex;gap:5px}.buttons button{min-width:72px;border:1px solid var(--line);border-radius:5px;background:var(--surface);color:var(--muted);font-weight:700;cursor:pointer}.buttons button[aria-pressed=true]{border-color:var(--ink);background:var(--ink);color:#fff}.files{display:grid;gap:8px}.file-card{display:grid;grid-template-columns:54px 1fr;overflow:hidden;border:1px solid var(--line);border-radius:6px;background:var(--surface)}.rank{padding-top:17px;background:var(--ink);color:#fff;font:800 15px ui-monospace,monospace;text-align:center}.file-main{min-width:0;padding:14px 16px}.file-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}.file-heading>div:first-child{display:flex;min-width:0;align-items:center;gap:7px}.file-heading h3{overflow-wrap:anywhere;margin:0;font-size:13px}.file-heading code{padding:2px 5px;border-radius:3px;background:var(--page);font-size:9px}.level{padding:3px 6px;border-radius:3px;color:#fff;font-size:8px;font-weight:800;text-transform:uppercase}.level-critical{background:var(--coral)}.level-high{background:#ae7910}.level-medium{background:var(--blue)}.level-low{background:var(--green)}.score{display:flex;align-items:baseline;white-space:nowrap}.score strong{font:800 21px ui-monospace,monospace}.score span{color:var(--muted);font:9px ui-monospace,monospace}.metrics{display:flex;flex-wrap:wrap;gap:12px;margin:8px 0 10px;color:var(--muted);font-size:9px}.metrics b{color:var(--ink)}.metrics i{margin-right:4px;padding:2px 5px;border-radius:3px;background:#edf0ed;font-style:normal}ul{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin:0;padding:0;list-style:none}li{display:grid;grid-template-columns:1fr auto;gap:2px 6px;padding:8px;border-left:3px solid var(--yellow);background:var(--page)}li.reduces{border-color:var(--green)}li span,li strong{font-size:9px}li small{grid-column:1/-1;color:var(--muted);font-size:8px}.file-card[hidden]{display:none}.empty,.empty-chart{display:grid;min-height:90px;place-items:center;color:var(--muted);font:10px ui-monospace,monospace;text-transform:uppercase}@media(max-width:720px){.topbar{padding:0 13px}.topbar>span{display:none}main{padding:25px 13px}.heading{align-items:flex-start}.heading h1{font-size:24px}.overall{gap:7px}.dial{width:52px;height:52px;border-width:5px;font-size:17px}.summary{grid-template-columns:repeat(2,1fr)}.summary div{border-bottom:1px solid var(--line)}.summary div:nth-child(even){border-right:0}.summary div:last-child{grid-column:1/-1;border-bottom:0}.dashboard{grid-template-columns:1fr}.filters{grid-template-columns:1fr}.buttons{overflow-x:auto}.buttons button{min-width:64px}.file-card{grid-template-columns:1fr}.rank{padding:5px}.file-heading>div:first-child{align-items:flex-start;flex-wrap:wrap}.metrics{gap:7px}ul{grid-template-columns:1fr}}
</style></head><body><header class="topbar"><div class="brand"><span class="mark">GRM</span>Git Risk Map</div><span>Generated ${escapeHtml(generated)}</span></header><main><div class="heading"><div><span class="eyebrow">deterministic review intelligence</span><h1>${escapeHtml(report.repository)}</h1><p>${escapeHtml(report.comparison)}</p></div><div class="overall"><div class="dial">${report.overall.score}</div><div><span>Overall risk</span><strong>${escapeHtml(report.overall.level)}</strong></div></div></div>
<section class="summary"><div><span>Changed files</span><strong>${report.summary.files}</strong></div><div><span>Added</span><strong>+${report.summary.additions}</strong></div><div><span>Removed</span><strong>-${report.summary.deletions}</strong></div><div><span>Test ratio</span><strong>${report.summary.testChangeRatio ?? "n/a"}</strong></div><div><span>History window</span><strong>${report.historyDays}d</strong></div></section>
<div class="dashboard"><section class="panel"><h2>Highest-risk files</h2>${bars}</section><section class="panel"><h2>Suggested review sequence</h2><div class="plan">${report.reviewPlan.map((group, index) => `<div><b>${index + 1}</b><span>${escapeHtml(group.title)}<small>${escapeHtml(group.files.join(", "))}</small></span></div>`).join("") || '<div class="empty-chart">No review needed</div>'}</div></section></div>
<div class="filters"><input id="search" type="search" placeholder="Filter by file, tag, or signal" aria-label="Filter files"><div class="buttons" role="group" aria-label="Risk filter"><button data-filter="all" aria-pressed="true">All</button><button data-filter="critical" aria-pressed="false">Critical</button><button data-filter="high" aria-pressed="false">High</button><button data-filter="medium" aria-pressed="false">Medium</button><button data-filter="low" aria-pressed="false">Low</button></div></div><section class="files">${cards}</section></main><script>const search=document.querySelector('#search');let level='all';function apply(){const q=search.value.trim().toLowerCase();document.querySelectorAll('.file-card').forEach(card=>{card.hidden=(level!=='all'&&card.dataset.level!==level)||(q&&!card.dataset.search.includes(q))})}search.addEventListener('input',apply);document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{level=button.dataset.filter;document.querySelectorAll('[data-filter]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));apply()}));</script></body></html>`;
}

module.exports = { cleanReport, escapeHtml, renderHtml, renderJson, renderMarkdown, renderPretty };
