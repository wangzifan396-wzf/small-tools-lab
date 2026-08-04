(function initializeSchemaScout() {
  "use strict";

  const Core = window.SchemaScout;
  const elements = {
    analyze: document.querySelector("#analyze-button"),
    code: document.querySelector("#code-output"),
    copy: document.querySelector("#copy-button"),
    download: document.querySelector("#download-button"),
    dropZone: document.querySelector("#drop-zone"),
    fileInput: document.querySelector("#file-input"),
    fieldRows: document.querySelector("#field-rows"),
    input: document.querySelector("#json-input"),
    lineNumbers: document.querySelector("#line-numbers"),
    parseStatus: document.querySelector("#parse-status"),
    rootName: document.querySelector("#root-name"),
    sample: document.querySelector("#sample-button"),
    search: document.querySelector("#field-search"),
    sourceSize: document.querySelector("#source-size"),
    stats: {
      records: document.querySelector("#stat-records"),
      fields: document.querySelector("#stat-fields"),
      depth: document.querySelector("#stat-depth"),
      nulls: document.querySelector("#stat-nulls")
    },
    tableEmpty: document.querySelector("#table-empty"),
    theme: document.querySelector("#theme-toggle"),
    toast: document.querySelector("#toast"),
    upload: document.querySelector("#upload-button")
  };

  const state = { data: null, report: null, format: "schema", filename: "schema-scout" };
  let toastTimer = 0;
  const sampleData = [
    { id: "TASK-104", title: "Review empty states", status: "active", priority: 2, owner: { name: "Mina", team: "Design" }, labels: ["ui", "accessibility"], estimate: 3, closedAt: null },
    { id: "TASK-105", title: "Index search results", status: "active", priority: 1, owner: { name: "Owen", team: "Platform" }, labels: ["search"], estimate: 8, due: "2026-08-09" },
    { id: "TASK-106", title: "Archive old exports", status: "done", priority: 3, owner: { name: "Lena", team: "Platform" }, labels: [], estimate: 2, closedAt: "2026-07-30" },
    { id: "TASK-107", title: "Document color tokens", status: "active", priority: 2, owner: null, labels: ["docs", "design-system"], estimate: 5, due: "2026-08-12" }
  ];

  function showToast(message) {
    clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.add("visible");
    toastTimer = setTimeout(() => elements.toast.classList.remove("visible"), 2000);
  }

  function byteSize(text) {
    const bytes = new TextEncoder().encode(text).length;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  function updateEditorMeta() {
    const count = elements.input.value.split("\n").length;
    elements.lineNumbers.textContent = Array.from({ length: count }, (_, index) => index + 1).join("\n");
    elements.sourceSize.textContent = byteSize(elements.input.value);
  }

  function setStatus(message, error) {
    elements.parseStatus.className = error ? "status-error" : "status-ready";
    elements.parseStatus.innerHTML = `<i></i>${message}`;
  }

  function parseInput() {
    try {
      const data = JSON.parse(elements.input.value);
      setStatus("Valid JSON", false);
      return data;
    } catch (error) {
      const position = /position (\d+)/.exec(error.message);
      let suffix = "";
      if (position) {
        const before = elements.input.value.slice(0, Number(position[1]));
        suffix = ` at ${before.split("\n").length}:${before.split("\n").pop().length + 1}`;
      }
      setStatus(`Invalid JSON${suffix}`, true);
      showToast(error.message);
      return null;
    }
  }

  function outputText() {
    if (!state.report) return "// Analyze JSON to generate output";
    if (state.format === "typescript") return Core.toTypeScript(state.data, elements.rootName.value);
    if (state.format === "catalog") return Core.toCatalogCsv(state.report);
    return JSON.stringify(Core.toJsonSchema(state.data, elements.rootName.value), null, 2);
  }

  function renderOutput() {
    elements.code.textContent = outputText();
  }

  function fieldRow(field) {
    const types = field.types.map((type) => `<span class="type-chip type-${type}">${type}</span>`).join("");
    const coverage = `${(field.coverage * 100).toFixed(field.coverage === 1 ? 0 : 1)}%`;
    return `<tr data-path="${escapeHtml(field.path.toLowerCase())}">
      <td class="path-code" title="${escapeHtml(field.path)}">${escapeHtml(field.path)}</td>
      <td><span class="type-list">${types}</span></td>
      <td><span class="coverage-cell"><i class="coverage-track"><i style="--coverage:${coverage}"></i></i><span>${coverage}</span></span></td>
      <td class="example-code" title="${escapeHtml(field.examples.join(" | "))}">${escapeHtml(field.examples[0] || "-")}</td>
    </tr>`;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
  }

  function renderReport() {
    const report = state.report;
    if (!report) return;
    elements.stats.records.textContent = report.records.toLocaleString();
    elements.stats.fields.textContent = report.fields.length.toLocaleString();
    elements.stats.depth.textContent = report.maxDepth.toLocaleString();
    elements.stats.nulls.textContent = report.nulls.toLocaleString();
    elements.fieldRows.innerHTML = report.fields.map(fieldRow).join("");
    elements.tableEmpty.hidden = report.fields.length > 0;
    renderOutput();
    filterFields();
  }

  function analyze() {
    const data = parseInput();
    if (data === null && elements.input.value.trim() !== "null") return;
    state.data = data;
    state.report = Core.analyze(data);
    renderReport();
  }

  function loadSample() {
    elements.input.value = JSON.stringify(sampleData, null, 2);
    state.filename = "task-dataset";
    updateEditorMeta();
    analyze();
  }

  function loadFile(file) {
    if (!file || (file.type && file.type !== "application/json" && !file.name.toLowerCase().endsWith(".json"))) {
      showToast("Choose a JSON file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast("JSON file must be smaller than 10 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      elements.input.value = String(reader.result);
      state.filename = file.name.replace(/\.json$/i, "") || "schema-scout";
      updateEditorMeta();
      analyze();
    };
    reader.onerror = () => showToast("The file could not be read");
    reader.readAsText(file);
  }

  function filterFields() {
    const query = elements.search.value.trim().toLowerCase();
    let visible = 0;
    elements.fieldRows.querySelectorAll("tr").forEach((row) => {
      row.hidden = Boolean(query) && !row.dataset.path.includes(query);
      if (!row.hidden) visible += 1;
    });
    elements.tableEmpty.hidden = visible > 0;
    if (!visible) elements.tableEmpty.textContent = query ? "No matching paths" : "No fields";
  }

  function copyText(text) {
    const fallback = () => {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
      showToast("Output copied");
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(() => showToast("Output copied"), fallback);
    else fallback();
  }

  function downloadOutput() {
    const extension = { schema: "schema.json", typescript: "d.ts", catalog: "csv" }[state.format];
    const blob = new Blob([outputText() + "\n"], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${state.filename}.${extension}`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function setTheme(theme) {
    const selected = theme === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = selected;
    elements.theme.setAttribute("aria-label", selected === "dark" ? "Use light theme" : "Use dark theme");
    localStorage.setItem("schema-scout-theme", selected);
  }

  function bindEvents() {
    elements.analyze.addEventListener("click", analyze);
    elements.sample.addEventListener("click", loadSample);
    elements.upload.addEventListener("click", () => elements.fileInput.click());
    elements.fileInput.addEventListener("change", () => loadFile(elements.fileInput.files[0]));
    elements.input.addEventListener("input", updateEditorMeta);
    elements.input.addEventListener("scroll", () => { elements.lineNumbers.scrollTop = elements.input.scrollTop; });
    elements.rootName.addEventListener("input", renderOutput);
    elements.search.addEventListener("input", filterFields);
    elements.copy.addEventListener("click", () => copyText(outputText()));
    elements.download.addEventListener("click", downloadOutput);
    elements.theme.addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));

    document.querySelectorAll('[role="tab"]').forEach((tab) => {
      tab.addEventListener("click", () => {
        state.format = tab.dataset.format;
        document.querySelectorAll('[role="tab"]').forEach((item) => {
          const selected = item === tab;
          item.setAttribute("aria-selected", String(selected));
          item.tabIndex = selected ? 0 : -1;
        });
        renderOutput();
      });
      tab.addEventListener("keydown", (event) => {
        const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
        const index = tabs.indexOf(tab);
        const next = event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index - 1 + tabs.length) % tabs.length : -1;
        if (next < 0) return;
        event.preventDefault();
        tabs[next].focus();
        tabs[next].click();
      });
    });

    ["dragenter", "dragover"].forEach((name) => elements.dropZone.addEventListener(name, (event) => { event.preventDefault(); elements.dropZone.classList.add("dragging"); }));
    ["dragleave", "dragend"].forEach((name) => elements.dropZone.addEventListener(name, () => elements.dropZone.classList.remove("dragging")));
    elements.dropZone.addEventListener("drop", (event) => { event.preventDefault(); elements.dropZone.classList.remove("dragging"); loadFile(event.dataTransfer.files[0]); });
  }

  const savedTheme = localStorage.getItem("schema-scout-theme");
  const preferred = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  setTheme(savedTheme || preferred);
  bindEvents();
  loadSample();
})();
