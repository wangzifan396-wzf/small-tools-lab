const Core = window.HarViewer;
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const SVG_NS = "http://www.w3.org/2000/svg";

const state = { report: null, fileName: "capture.har", selectedId: null };
const $ = (id) => document.getElementById(id);
const elements = {
  importPanel: $("import-panel"), dashboard: $("dashboard"), status: $("status"), file: $("file"), sample: $("sample"), drop: $("drop-zone"),
  theme: $("theme"), newFile: $("new-file"), csv: $("csv"), sanitize: $("sanitize"), fileName: $("file-name"), captureMeta: $("capture-meta"),
  requestCount: $("request-count"), failedCount: $("failed-count"), domainCount: $("domain-count"), transferTotal: $("transfer-total"), durationTotal: $("duration-total"),
  search: $("search"), statusFilter: $("status-filter"), domainFilter: $("domain-filter"), typeFilter: $("type-filter"), pageFilter: $("page-filter"), durationFilter: $("duration-filter"), clearFilters: $("clear-filters"),
  requestList: $("request-list"), requestEmpty: $("request-empty"), visibleCount: $("visible-count"), findings: $("findings"), findingEmpty: $("finding-empty"), findingCount: $("finding-count"), detail: $("detail"),
};

function sampleEntry({ url, start, time, status = 200, mimeType = "application/json", size = 1200, type, timings, headers = [] }) {
  return {
    pageref: "page-home", startedDateTime: `2026-08-16T08:00:00.${String(start).padStart(3, "0")}Z`, time,
    request: { method: url.includes("/api/") ? "GET" : "GET", url, httpVersion: "HTTP/2", headers: [{ name: "Accept", value: "*/*" }], queryString: [], cookies: [], headersSize: 180, bodySize: 0 },
    response: { status, statusText: status === 0 ? "Network error" : status >= 400 ? "Service Unavailable" : "OK", httpVersion: "HTTP/2", headers: [{ name: "Content-Type", value: mimeType }, ...headers], cookies: [], content: { size, mimeType }, redirectURL: "", headersSize: 220, bodySize: size, _transferSize: status === 0 ? 0 : size + 220 },
    cache: {}, timings, serverIPAddress: "203.0.113.20", connection: "17", _resourceType: type,
  };
}

function sampleHar() {
  return { log: { version: "1.2", creator: { name: "HAR Viewer sample", version: "1.0" }, pages: [{ id: "page-home", title: "Storefront", startedDateTime: "2026-08-16T08:00:00.000Z", pageTimings: { onContentLoad: 840, onLoad: 2310 } }], entries: [
    sampleEntry({ url: "https://shop.example.com/", start: 0, time: 420, mimeType: "text/html", size: 18400, type: "document", timings: { blocked: 5, dns: 28, connect: 65, ssl: 42, send: 3, wait: 270, receive: 49 }, headers: [{ name: "Content-Encoding", value: "br" }, { name: "Cache-Control", value: "no-cache" }] }),
    sampleEntry({ url: "https://cdn.example.com/app.css", start: 125, time: 115, mimeType: "text/css", size: 9200, type: "stylesheet", timings: { blocked: 3, dns: 12, connect: 22, ssl: 18, send: 2, wait: 46, receive: 30 }, headers: [{ name: "Content-Encoding", value: "br" }, { name: "Cache-Control", value: "public, max-age=86400" }] }),
    sampleEntry({ url: "https://cdn.example.com/app.js", start: 150, time: 570, mimeType: "application/javascript", size: 186000, type: "script", timings: { blocked: 4, dns: 0, connect: 0, send: 3, wait: 380, receive: 183 }, headers: [] }),
    sampleEntry({ url: "https://shop.example.com/api/products?limit=20", start: 440, time: 1840, status: 503, mimeType: "application/json", size: 820, type: "fetch", timings: { blocked: 6, dns: 0, connect: 0, send: 4, wait: 1760, receive: 70 }, headers: [{ name: "Cache-Control", value: "no-store" }] }),
    sampleEntry({ url: "https://images.example.net/hero.webp", start: 520, time: 930, mimeType: "image/webp", size: 1350000, type: "image", timings: { blocked: 15, dns: 280, connect: 410, ssl: 310, send: 3, wait: 145, receive: 77 }, headers: [] }),
    sampleEntry({ url: "https://analytics.example.org/pixel", start: 610, time: 72, status: 0, mimeType: "image/gif", size: 0, type: "image", timings: { blocked: 8, dns: 0, connect: 0, send: 0, wait: 64, receive: 0 }, headers: [] }),
  ] } };
}

function setStatus(message, isError = false) {
  elements.status.textContent = message;
  elements.status.className = isError ? "status error" : "status";
}

function option(value, label) {
  const item = document.createElement("option"); item.value = value; item.textContent = label; return item;
}

function replaceOptions(select, values, firstLabel, labels = {}) {
  select.replaceChildren(option("all", firstLabel));
  values.forEach((value) => select.append(option(value, labels[value] || value)));
}

function resetFilters() {
  elements.search.value = ""; elements.statusFilter.value = "all"; elements.domainFilter.value = "all";
  elements.typeFilter.value = "all"; elements.pageFilter.value = "all"; elements.durationFilter.value = "0";
}

function loadDocument(document, name) {
  try {
    state.report = Core.analyzeHar(document); state.fileName = name || "capture.har";
    state.selectedId = state.report.summary.slowest?.id || state.report.entries[0]?.id || null;
    const domains = [...new Set(state.report.entries.map((item) => item.domain))].sort();
    const types = [...new Set(state.report.entries.map((item) => item.type))].sort();
    const pageIds = [...new Set(state.report.entries.map((item) => item.pageRef).filter(Boolean))].sort();
    replaceOptions(elements.domainFilter, domains, "All domains"); replaceOptions(elements.typeFilter, types, "All types");
    replaceOptions(elements.pageFilter, pageIds, "All pages", Object.fromEntries(pageIds.map((id) => [id, state.report.pages[id]?.title || id])));
    resetFilters(); elements.importPanel.hidden = true; elements.dashboard.hidden = false;
    setStatus(""); render();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Could not analyze this HAR file.", true);
  }
}

function render() {
  const { summary, issues, document } = state.report;
  elements.fileName.textContent = state.fileName;
  elements.captureMeta.textContent = `${document.log.creator?.name || "Unknown creator"} · HAR ${document.log.version || "unknown"} · ${issues.length} parser ${issues.length === 1 ? "notice" : "notices"}`;
  elements.requestCount.textContent = String(summary.requestCount); elements.failedCount.textContent = String(summary.failedCount);
  elements.domainCount.textContent = String(summary.domainCount); elements.transferTotal.textContent = Core.formatBytes(summary.transferredBytes); elements.durationTotal.textContent = Core.formatDuration(summary.totalDuration);
  renderRequests(); renderFindings(); renderDetail();
}

function filters() {
  return { query: elements.search.value.trim(), status: elements.statusFilter.value, domain: elements.domainFilter.value, type: elements.typeFilter.value, page: elements.pageFilter.value, minDuration: Number(elements.durationFilter.value) };
}

function filteredEntries() { return Core.filterEntries(state.report.entries, filters()); }

function svgRect(className, x, width) {
  const rect = document.createElementNS(SVG_NS, "rect"); rect.setAttribute("class", className); rect.setAttribute("x", String(x)); rect.setAttribute("y", "2"); rect.setAttribute("width", String(Math.max(0, width))); rect.setAttribute("height", "7"); rect.setAttribute("rx", "1"); return rect;
}

function waterfallGraphic(row) {
  const svg = document.createElementNS(SVG_NS, "svg"); svg.setAttribute("class", "waterfall"); svg.setAttribute("viewBox", "0 0 100 11"); svg.setAttribute("preserveAspectRatio", "none"); svg.setAttribute("aria-label", `Starts ${Core.formatDuration(row.offset)} into the capture and lasts ${Core.formatDuration(row.duration)}`);
  svg.append(svgRect("track", 0, 100), svgRect("base", row.offsetPercent, row.widthPercent));
  row.phaseLayout.forEach((phase) => {
    if (phase.duration <= 0) return;
    const x = row.offsetPercent + row.widthPercent * phase.offsetPercent / 100;
    const width = row.widthPercent * phase.widthPercent / 100;
    svg.append(svgRect(phase.name, x, width));
  });
  return svg;
}

function renderRequests() {
  const visible = filteredEntries(); const rows = new Map(Core.buildWaterfall(state.report.entries).rows.map((row) => [row.id, row]));
  elements.requestList.replaceChildren(); elements.visibleCount.textContent = String(visible.length); elements.requestEmpty.hidden = visible.length !== 0;
  visible.forEach((entry) => {
    const button = document.createElement("button"); button.type = "button"; button.className = "request-row"; button.setAttribute("role", "listitem");
    if (entry.id === state.selectedId) button.classList.add("selected");
    const status = document.createElement("span"); status.className = "status-code" + (entry.failed ? " failed" : ""); status.textContent = entry.status ? String(entry.status) : "ERR";
    const copy = document.createElement("span"); copy.className = "request-copy";
    const path = document.createElement("strong"); path.textContent = `${entry.method} ${entry.path}`; const domain = document.createElement("small"); domain.textContent = entry.domain; copy.append(path, domain);
    const type = document.createElement("span"); type.className = "type"; type.textContent = entry.type;
    const size = document.createElement("span"); size.className = "metric"; size.textContent = Core.formatBytes(entry.transferSize);
    const duration = document.createElement("span"); duration.className = "metric"; duration.textContent = Core.formatDuration(entry.duration);
    button.append(status, copy, type, size, duration, waterfallGraphic(rows.get(entry.id)));
    button.addEventListener("click", () => { state.selectedId = entry.id; renderRequests(); renderDetail(); }); elements.requestList.append(button);
  });
}

function renderFindings() {
  elements.findings.replaceChildren(); elements.findingCount.textContent = String(state.report.findings.length); elements.findingEmpty.hidden = state.report.findings.length !== 0;
  state.report.findings.forEach((finding) => {
    const button = document.createElement("button"); button.type = "button"; button.className = `finding ${finding.severity}`;
    const body = document.createElement("span"); const title = document.createElement("strong"); title.textContent = finding.title; const detail = document.createElement("small"); detail.textContent = finding.detail; body.append(title, detail); button.append(body);
    if (finding.entryId) button.addEventListener("click", () => { state.selectedId = finding.entryId; renderRequests(); renderDetail(); document.querySelector(".detail-panel").scrollIntoView({ behavior: "smooth", block: "nearest" }); });
    elements.findings.append(button);
  });
}

function fact(label, value) {
  const item = document.createElement("div"); item.className = "fact"; const key = document.createElement("span"); key.textContent = label; const output = document.createElement("strong"); output.textContent = value; item.append(key, output); return item;
}

function pairList(title, pairs) {
  const fragment = document.createDocumentFragment(); const heading = document.createElement("h3"); heading.textContent = title; fragment.append(heading);
  if (!pairs.length) { const empty = document.createElement("p"); empty.className = "empty"; empty.textContent = "None recorded"; fragment.append(empty); return fragment; }
  pairs.forEach((item) => { const row = document.createElement("div"); row.className = "pair"; const name = document.createElement("span"); name.textContent = String(item.name || "(unnamed)"); const value = document.createElement("code"); value.textContent = String(item.value ?? ""); row.append(name, value); fragment.append(row); }); return fragment;
}

function renderDetail() {
  elements.detail.replaceChildren(); const entry = state.report.entries.find((item) => item.id === state.selectedId);
  if (!entry) { const empty = document.createElement("p"); empty.className = "empty"; empty.textContent = "Select a request to inspect it."; elements.detail.append(empty); return; }
  const url = document.createElement("p"); url.className = "detail-url"; url.textContent = entry.url || "(missing URL)";
  const facts = document.createElement("div"); facts.className = "facts"; facts.append(fact("Method", entry.method), fact("Status", `${entry.status || "ERR"} ${entry.statusText}`.trim()), fact("MIME", entry.mimeType), fact("Transferred", Core.formatBytes(entry.transferSize)), fact("Duration", Core.formatDuration(entry.duration)), fact("Page", entry.pageTitle || entry.pageRef || "Unassigned"));
  const timingTitle = document.createElement("h3"); timingTitle.textContent = "Timing breakdown"; const timings = document.createElement("div"); timings.className = "timings";
  [...Core.PHASES, ...(entry.phases.ssl ? ["ssl"] : [])].forEach((name) => { const row = document.createElement("div"); row.className = "timing"; const label = document.createElement("span"); label.textContent = name === "ssl" ? "SSL (inside connect)" : name; const value = document.createElement("strong"); value.textContent = Core.formatDuration(entry.phases[name]); row.append(label, value); timings.append(row); });
  elements.detail.append(url, facts, timingTitle, timings, pairList("Query parameters", entry.queryString), pairList("Request headers", entry.requestHeaders), pairList("Response headers", entry.responseHeaders));
}

function readFile(file) {
  if (!file) return;
  if (file.size > MAX_FILE_SIZE) { setStatus("Choose a HAR or JSON file no larger than 25 MB.", true); return; }
  const reader = new FileReader();
  reader.onload = () => loadDocument(String(reader.result), file.name);
  reader.onerror = () => setStatus("The browser could not read this file.", true);
  reader.readAsText(file);
}

function openFilePicker() { elements.file.value = ""; elements.file.click(); }

function safeBaseName(name) { return name.replace(/\.har$/i, "").replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "") || "capture"; }
function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

elements.file.addEventListener("change", () => readFile(elements.file.files[0]));
elements.drop.addEventListener("click", openFilePicker);
elements.drop.addEventListener("dragover", (event) => { event.preventDefault(); elements.drop.classList.add("dragging"); });
elements.drop.addEventListener("dragleave", () => elements.drop.classList.remove("dragging"));
elements.drop.addEventListener("drop", (event) => { event.preventDefault(); elements.drop.classList.remove("dragging"); readFile(event.dataTransfer.files[0]); });
elements.sample.addEventListener("click", () => loadDocument(sampleHar(), "sample-storefront.har"));
elements.newFile.addEventListener("click", openFilePicker);
elements.theme.addEventListener("click", () => { document.documentElement.dataset.theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark"; });
[elements.search, elements.statusFilter, elements.domainFilter, elements.typeFilter, elements.pageFilter, elements.durationFilter].forEach((control) => control.addEventListener("input", renderRequests));
elements.clearFilters.addEventListener("click", () => { resetFilters(); renderRequests(); });
elements.csv.addEventListener("click", () => download(`${safeBaseName(state.fileName)}-requests.csv`, Core.entriesToCsv(filteredEntries()), "text/csv;charset=utf-8"));
elements.sanitize.addEventListener("click", () => {
  const clean = Core.sanitizeHar(state.report.document); download(`${safeBaseName(state.fileName)}-redacted.har`, JSON.stringify(clean, null, 2) + "\n", "application/json");
  setStatus("Redacted export created: bodies and network addresses removed; credentials, cookies, and secret fields replaced.");
});

if (new URLSearchParams(window.location.search).has("sample")) loadDocument(sampleHar(), "sample-storefront.har");
