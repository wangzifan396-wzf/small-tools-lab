"use strict";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

function escapeXml(value) { return escapeHtml(value); }
function ansi(enabled, code, value) { return enabled ? `\u001b[${code}m${value}\u001b[0m` : value; }

function renderSummary(packet, options) {
  const color = Boolean(options && options.color);
  const percent = packet.budget ? Math.round((packet.estimatedTokens / packet.budget) * 100) : 0;
  const lines = [ansi(color, "1", "PatchBrief"), "=".repeat(74)];
  lines.push(`${packet.repository}  |  ${packet.comparison}`);
  lines.push(`Budget ${packet.estimatedTokens.toLocaleString()} / ${packet.budget.toLocaleString()} tokens (${percent}%)  |  ${packet.changes.length} changed files`);
  lines.push(`Sections ${packet.sections.length} included / ${packet.excluded.length} excluded  |  Redactions ${packet.redaction.count}`);
  lines.push("", "Included context");
  packet.sections.forEach((section, index) => lines.push(`${String(index + 1).padStart(2)}. ${section.kind.padEnd(11)} ${String(section.tokens).padStart(5)} tokens  ${section.file}${section.truncated ? " [truncated]" : ""}`));
  if (packet.excluded.length) {
    lines.push("", "Excluded by budget");
    packet.excluded.slice(0, 20).forEach((section) => lines.push(`- ${section.kind.padEnd(11)} ${section.file} (${section.reason})`));
  }
  return `${lines.join("\n")}\n`;
}

function cleanPacket(packet) {
  return {
    tool: packet.tool, version: packet.version, generatedAt: packet.generatedAt, repository: packet.repository,
    comparison: packet.comparison, budget: packet.budget, estimatedTokens: packet.estimatedTokens,
    remainingTokens: packet.remainingTokens, contextLines: packet.contextLines, redaction: packet.redaction,
    changes: packet.changes, kindCounts: packet.kindCounts, sections: packet.sections, excluded: packet.excluded
  };
}

function renderJson(packet) { return `${JSON.stringify(cleanPacket(packet), null, 2)}\n`; }

function codeFence(content) {
  const runs = [...content.matchAll(/`+/g)].map((match) => match[0].length);
  return "`".repeat(Math.max(3, ...runs, 0) + 1);
}

function renderMarkdown(packet) {
  const lines = ["# PatchBrief", "", `Repository: **${packet.repository}**  `, `Comparison: \`${packet.comparison}\`  `, `Estimated tokens: **${packet.estimatedTokens.toLocaleString()} / ${packet.budget.toLocaleString()}**  `, `Redactions: **${packet.redaction.count}**${packet.redaction.types.length ? ` (${packet.redaction.types.join(", ")})` : ""}`, "", "## Selection manifest", "", "| Kind | File | Tokens | Why included |", "| --- | --- | ---: | --- |"];
  packet.sections.forEach((section) => lines.push(`| ${section.kind} | \`${section.file.replaceAll("|", "\\|")}\` | ${section.tokens} | ${section.reason.replaceAll("|", "\\|")}${section.truncated ? "; truncated" : ""} |`));
  if (!packet.sections.length) lines.push("| - | - | 0 | No changed context | ");
  if (packet.excluded.length) {
    lines.push("", "## Excluded by budget", "", "| Kind | File | Estimated tokens | Reason |", "| --- | --- | ---: | --- |");
    packet.excluded.forEach((section) => lines.push(`| ${section.kind} | \`${section.file.replaceAll("|", "\\|")}\` | ${section.tokens} | ${section.reason} |`));
  }
  lines.push("", "## Context");
  for (const section of packet.sections) {
    const fence = codeFence(section.content);
    lines.push("", `### ${section.title}`, "", `Source: \`${section.file}\` | Kind: ${section.kind} | Reason: ${section.reason}`, "", `${fence}${section.language || "text"}`, section.content, fence);
  }
  return `${lines.join("\n")}\n`;
}

function renderXml(packet) {
  const sections = packet.sections.map((section) => `  <section kind="${escapeXml(section.kind)}" file="${escapeXml(section.file)}" tokens="${section.tokens}" truncated="${Boolean(section.truncated)}"><reason>${escapeXml(section.reason)}</reason><content>${escapeXml(section.content)}</content></section>`).join("\n");
  const excluded = packet.excluded.map((section) => `  <excluded kind="${escapeXml(section.kind)}" file="${escapeXml(section.file)}" tokens="${section.tokens}">${escapeXml(section.reason)}</excluded>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<patchbrief repository="${escapeXml(packet.repository)}" comparison="${escapeXml(packet.comparison)}" budget="${packet.budget}" estimatedTokens="${packet.estimatedTokens}" redactions="${packet.redaction.count}">\n${sections}${excluded ? `\n${excluded}` : ""}\n</patchbrief>\n`;
}

function sectionCard(section, index) {
  return `<article class="section" data-kind="${escapeHtml(section.kind)}" data-search="${escapeHtml(`${section.kind} ${section.file} ${section.reason}`.toLowerCase())}"><div class="rank">${index + 1}</div><div class="section-main"><div class="section-heading"><span>${escapeHtml(section.kind)}</span><h3>${escapeHtml(section.file)}</h3><div><strong>${section.tokens.toLocaleString()}</strong><small>tokens</small></div></div><p>${escapeHtml(section.reason)}${section.truncated ? '<b>truncated</b>' : ""}${section.redactions ? `<b>${section.redactions} redacted</b>` : ""}</p><details><summary>Inspect context</summary><pre>${escapeHtml(section.content)}</pre></details></div></article>`;
}

function renderHtml(packet) {
  const sections = packet.sections.map(sectionCard).join("") || '<div class="empty">No changed context</div>';
  const kinds = Object.entries(packet.kindCounts).sort((a, b) => b[1] - a[1]);
  const maxKind = Math.max(1, ...kinds.map((item) => item[1]));
  const bars = kinds.map(([kind, count]) => `<div class="bar"><span>${escapeHtml(kind)}</span><i><b style="width:${(count / maxKind) * 100}%"></b></i><strong>${count}</strong></div>`).join("") || '<div class="empty-chart">No sections</div>';
  const percent = packet.budget ? Math.round((packet.estimatedTokens / packet.budget) * 100) : 0;
  const generated = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(packet.generatedAt));
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PatchBrief - ${escapeHtml(packet.repository)}</title><style>
:root{color-scheme:light;--page:#f4f5f3;--surface:#fff;--ink:#18201e;--muted:#68736f;--line:#ccd5d1;--green:#287760;--lime:#bed04c;--yellow:#d3a72d;--coral:#d75d4a;--blue:#4f79a9;font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}*{box-sizing:border-box}body{margin:0;background:var(--page);color:var(--ink);font-size:14px;line-height:1.45}.topbar{display:flex;height:58px;align-items:center;justify-content:space-between;padding:0 max(4vw,calc((100vw - 1360px)/2));border-bottom:1px solid var(--line);background:var(--surface)}.brand{display:flex;align-items:center;gap:10px;font-weight:800}.mark{display:grid;width:30px;height:30px;place-items:center;border-radius:5px;background:var(--ink);color:var(--lime);font:800 9px ui-monospace,monospace}.topbar>span{color:var(--muted);font:10px ui-monospace,monospace}main{padding:35px max(4vw,calc((100vw - 1360px)/2)) 60px}.heading{display:flex;align-items:end;justify-content:space-between;gap:24px}.eyebrow{color:var(--green);font:800 10px ui-monospace,monospace;text-transform:uppercase}.heading h1{margin:5px 0 2px;font-size:30px;letter-spacing:0}.heading p{margin:0;color:var(--muted);font:11px ui-monospace,monospace}.budget{display:flex;align-items:center;gap:12px}.dial{display:grid;width:68px;height:68px;place-items:center;border:7px solid var(--green);border-radius:50%;font:800 18px ui-monospace,monospace}.budget div:last-child{display:grid}.budget span{color:var(--muted);font-size:9px;font-weight:800;text-transform:uppercase}.budget strong{font:800 14px ui-monospace,monospace}.summary{display:grid;grid-template-columns:repeat(5,1fr);overflow:hidden;margin-top:25px;border:1px solid var(--line);border-radius:6px;background:var(--surface)}.summary div{padding:15px 17px;border-right:1px solid var(--line)}.summary div:last-child{border:0}.summary span{display:block;color:var(--muted);font-size:9px;font-weight:800;text-transform:uppercase}.summary strong{font:800 21px ui-monospace,monospace}.dashboard{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px}.panel{padding:19px;border:1px solid var(--line);border-radius:6px;background:var(--surface)}.panel h2{margin:0 0 14px;font-size:14px}.bar{display:grid;grid-template-columns:100px 1fr 25px;align-items:center;gap:8px;margin:8px 0}.bar span{color:var(--muted);font-size:9px}.bar i{height:7px;overflow:hidden;border-radius:3px;background:var(--page)}.bar b{display:block;height:100%;border-radius:3px;background:var(--green)}.bar strong{font:9px ui-monospace,monospace;text-align:right}.redaction{display:grid;grid-template-columns:auto 1fr;gap:12px}.redaction>strong{font:800 36px ui-monospace,monospace;color:var(--coral)}.redaction p{margin:2px 0;color:var(--muted);font-size:10px}.redaction code{display:inline-block;margin:3px 3px 0 0;padding:2px 5px;border-radius:3px;background:var(--page);font-size:8px}.filters{display:grid;grid-template-columns:1fr auto;gap:8px;margin:27px 0 11px}.filters input{height:40px;padding:8px 11px;border:1px solid var(--line);border-radius:5px;background:var(--surface);font:inherit}.buttons{display:flex;gap:5px}.buttons button{min-width:76px;border:1px solid var(--line);border-radius:5px;background:var(--surface);color:var(--muted);font-weight:700;cursor:pointer}.buttons button[aria-pressed=true]{border-color:var(--ink);background:var(--ink);color:#fff}.sections{display:grid;gap:8px}.section{display:grid;grid-template-columns:52px minmax(0,1fr);overflow:hidden;border:1px solid var(--line);border-radius:6px;background:var(--surface)}.rank{padding-top:16px;background:var(--ink);color:#fff;font:800 14px ui-monospace,monospace;text-align:center}.section-main{min-width:0;padding:13px 15px}.section-heading{display:flex;align-items:center;gap:8px}.section-heading>span{padding:3px 6px;border-radius:3px;background:var(--green);color:#fff;font-size:8px;font-weight:800;text-transform:uppercase}.section-heading h3{overflow-wrap:anywhere;margin:0;font-size:12px}.section-heading>div{display:grid;margin-left:auto;text-align:right}.section-heading strong{font:800 15px ui-monospace,monospace}.section-heading small{color:var(--muted);font-size:7px;text-transform:uppercase}.section-main>p{display:flex;align-items:center;gap:6px;margin:6px 0;color:var(--muted);font-size:9px}.section-main>p b{padding:2px 5px;border-radius:3px;background:#f4e9df;color:#965c1f;font-size:7px;text-transform:uppercase}details{border-top:1px solid var(--line)}summary{padding:8px 0 2px;color:var(--green);font-size:9px;font-weight:800;cursor:pointer}pre{max-height:420px;overflow:auto;margin:7px 0 0;padding:11px;border-radius:4px;background:#18201e;color:#e0e8e4;font-size:9px;white-space:pre-wrap}.section[hidden]{display:none}.empty,.empty-chart{display:grid;min-height:90px;place-items:center;color:var(--muted);font:10px ui-monospace,monospace;text-transform:uppercase}@media(max-width:720px){.topbar{padding:0 13px}.topbar>span{display:none}main{padding:25px 13px}.heading{align-items:flex-start}.heading h1{font-size:24px}.dial{width:52px;height:52px;border-width:5px;font-size:14px}.summary{grid-template-columns:repeat(2,1fr)}.summary div{border-bottom:1px solid var(--line)}.summary div:nth-child(even){border-right:0}.summary div:last-child{grid-column:1/-1;border-bottom:0}.dashboard{grid-template-columns:1fr}.filters{grid-template-columns:1fr}.buttons{overflow-x:auto}.buttons button{min-width:68px}.section{grid-template-columns:1fr}.rank{padding:5px}.section-heading{align-items:flex-start;flex-wrap:wrap}.section-heading>div{margin-left:0}.section-main>p{align-items:flex-start;flex-wrap:wrap}}
</style></head><body><header class="topbar"><div class="brand"><span class="mark">PB</span>PatchBrief</div><span>Generated ${escapeHtml(generated)}</span></header><main><div class="heading"><div><span class="eyebrow">minimal review context</span><h1>${escapeHtml(packet.repository)}</h1><p>${escapeHtml(packet.comparison)}</p></div><div class="budget"><div class="dial">${percent}%</div><div><span>Token budget</span><strong>${packet.estimatedTokens.toLocaleString()} / ${packet.budget.toLocaleString()}</strong></div></div></div><section class="summary"><div><span>Changed files</span><strong>${packet.changes.length}</strong></div><div><span>Included sections</span><strong>${packet.sections.length}</strong></div><div><span>Excluded</span><strong>${packet.excluded.length}</strong></div><div><span>Redactions</span><strong>${packet.redaction.count}</strong></div><div><span>Context lines</span><strong>${packet.contextLines}</strong></div></section><div class="dashboard"><section class="panel"><h2>Context composition</h2>${bars}</section><section class="panel"><h2>Secret redaction</h2><div class="redaction"><strong>${packet.redaction.count}</strong><div><p>${packet.redaction.enabled ? "Enabled before budgeting and output." : "Disabled by explicit CLI option."}</p>${packet.redaction.types.map((type) => `<code>${escapeHtml(type)}</code>`).join("")}</div></div></section></div><div class="filters"><input id="search" type="search" placeholder="Filter by file, kind, or reason" aria-label="Filter sections"><div class="buttons" role="group" aria-label="Context kind filter"><button data-filter="all" aria-pressed="true">All</button>${[...new Set(packet.sections.map((item) => item.kind))].slice(0, 5).map((kind) => `<button data-filter="${escapeHtml(kind)}" aria-pressed="false">${escapeHtml(kind)}</button>`).join("")}</div></div><section class="sections">${sections}</section></main><script>const search=document.querySelector('#search');let kind='all';function apply(){const q=search.value.trim().toLowerCase();document.querySelectorAll('.section').forEach(item=>{item.hidden=(kind!=='all'&&item.dataset.kind!==kind)||(q&&!item.dataset.search.includes(q))})}search.addEventListener('input',apply);document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{kind=button.dataset.filter;document.querySelectorAll('[data-filter]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));apply()}));</script></body></html>`;
}

module.exports = { cleanPacket, escapeHtml, renderHtml, renderJson, renderMarkdown, renderSummary, renderXml };
