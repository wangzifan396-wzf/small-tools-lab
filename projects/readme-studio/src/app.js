(function initializeReadmeStudio() {
  "use strict";

  const Core = window.ReadmeStudio;
  const elements = {
    accent: document.querySelector("#accent-color"),
    canvas: document.querySelector("#cover-canvas"),
    characterCount: document.querySelector("#character-count"),
    copy: document.querySelector("#copy-button"),
    coverDownload: document.querySelector("#cover-download"),
    download: document.querySelector("#download-button"),
    markdown: document.querySelector("#markdown-output"),
    preview: document.querySelector("#preview-output"),
    reset: document.querySelector("#reset-button"),
    saveStatus: document.querySelector("#save-status"),
    sectionCount: document.querySelector("#section-count"),
    theme: document.querySelector("#theme-toggle"),
    toast: document.querySelector("#toast")
  };
  let state = Core.template("app");
  let view = "preview";
  let toastTimer = 0;
  let saveTimer = 0;

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.add("visible");
    toastTimer = setTimeout(() => elements.toast.classList.remove("visible"), 2000);
  }

  function normalizedLines(value) {
    return String(value).split("\n").map((item) => item.trim()).filter(Boolean);
  }

  function syncForm() {
    document.querySelectorAll("[data-field]").forEach((input) => { input.value = state[input.dataset.field] || ""; });
    document.querySelector('[data-list="features"]').value = state.features.join("\n");
    document.querySelector('[data-list="roadmap"]').value = state.roadmap.join("\n");
    document.querySelector('[data-list="stack"]').value = state.stack.join(", ");
    document.querySelectorAll("[data-toggle]").forEach((input) => { input.checked = state.toggles[input.dataset.toggle] !== false; });
    document.querySelectorAll("[data-template]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.template === state.template)));
    elements.accent.value = state.accent;
  }

  function fitText(context, text, maxWidth, preferredSize, minimumSize) {
    let size = preferredSize;
    while (size > minimumSize) {
      context.font = `800 ${size}px Inter, Arial, sans-serif`;
      if (context.measureText(text).width <= maxWidth) return size;
      size -= 2;
    }
    context.font = `800 ${minimumSize}px Inter, Arial, sans-serif`;
    const measured = context.measureText(text).width;
    return Math.max(18, Math.floor(minimumSize * maxWidth / Math.max(measured, 1)));
  }

  function wrapText(context, text, maxWidth) {
    const words = String(text).split(/\s+/);
    const lines = [];
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && context.measureText(candidate).width > maxWidth) { lines.push(line); line = word; }
      else line = candidate;
    }
    if (line) lines.push(line);
    return lines;
  }

  function drawCover() {
    const context = elements.canvas.getContext("2d");
    const width = elements.canvas.width;
    const height = elements.canvas.height;
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#151d1b";
    context.fillRect(0, 0, width, height);

    context.strokeStyle = "rgba(238, 244, 240, 0.08)";
    context.lineWidth = 1;
    for (let x = 60; x < width; x += 60) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke(); }
    for (let y = 60; y < height; y += 60) { context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke(); }

    context.fillStyle = state.accent;
    context.fillRect(0, 0, 18, height);
    context.fillRect(74, 72, 54, 10);
    context.fillStyle = "#dfb247";
    context.fillRect(136, 72, 30, 10);
    context.fillStyle = "#da6450";
    context.fillRect(174, 72, 18, 10);

    context.fillStyle = "rgba(238,244,240,0.66)";
    context.font = "700 21px Consolas, monospace";
    context.fillText(`OPEN SOURCE / ${state.template.toUpperCase()}`, 74, 132);

    const name = state.name.trim() || "Untitled project";
    const nameSize = fitText(context, name, 840, 92, 30);
    context.font = `800 ${nameSize}px Inter, Arial, sans-serif`;
    context.fillStyle = "#f1f5f2";
    context.fillText(name, 74, 285);

    context.font = "500 32px Inter, Arial, sans-serif";
    context.fillStyle = "rgba(238,244,240,0.72)";
    wrapText(context, state.tagline, 760).slice(0, 2).forEach((line, index) => context.fillText(line, 76, 355 + index * 44));

    const blocks = [0.34, 0.58, 0.82, 0.46];
    blocks.forEach((scale, index) => {
      context.fillStyle = index === 0 ? state.accent : index === 1 ? "#dfb247" : index === 2 ? "#da6450" : "#edf3ef";
      context.fillRect(1010 + index * 34, height - 90 - 210 * scale, 20, 210 * scale);
    });

    context.fillStyle = "rgba(238,244,240,0.56)";
    context.font = "500 18px Consolas, monospace";
    let host = "LOCAL-FIRST PROJECT";
    try { host = new URL(state.repository).host.toUpperCase(); } catch (_error) {}
    context.fillText(host, 74, height - 68);
    context.fillText(state.license, width - 160, height - 68);
  }

  function previewSections() {
    const badges = state.toggles.badges ? `<div class="badge-list"><span>${escapeHtml(state.license)}</span><span>active</span>${state.stack.slice(0, 2).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>` : "";
    const cover = state.toggles.cover ? `<div class="preview-cover" style="--preview-accent:${escapeHtml(state.accent)}"><strong>${escapeHtml(state.name)}</strong></div>` : "";
    const tocItems = [state.features.length && "Features", state.installCommand && "Quick start", state.usage && "Usage", state.toggles.roadmap && state.roadmap.length && "Roadmap", state.toggles.contributing && "Contributing", state.toggles.license && "License"].filter(Boolean);
    const toc = state.toggles.toc ? `<h2>Contents</h2><ul>${tocItems.map((item) => `<li><a href="#">${escapeHtml(item)}</a></li>`).join("")}</ul>` : "";
    const features = state.features.length ? `<h2>Features</h2><ul>${state.features.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : "";
    const quickStart = state.installCommand ? `<h2>Quick start</h2><pre>${escapeHtml(state.installCommand)}</pre>` : "";
    const usage = state.usage ? `<h2>Usage</h2><pre>${escapeHtml(state.usage)}</pre>` : "";
    const stack = state.stack.length ? `<h2>Built with</h2><ul>${state.stack.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : "";
    const roadmap = state.toggles.roadmap && state.roadmap.length ? `<h2>Roadmap</h2><ul class="roadmap-list">${state.roadmap.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : "";
    const contributing = state.toggles.contributing ? "<h2>Contributing</h2><p>Contributions are welcome. Please open an issue before starting substantial changes and include tests with behavior changes.</p>" : "";
    const license = state.toggles.license ? `<h2>License</h2><p>Distributed under the ${escapeHtml(state.license)} license. See <a href="#">LICENSE</a> for details.</p>` : "";
    return `<h1>${escapeHtml(state.name || "Untitled project")}</h1><p class="preview-tagline">${escapeHtml(state.tagline)}</p>${cover}${badges}<p>${escapeHtml(state.description)}</p>${toc}${features}${quickStart}${usage}${stack}${roadmap}${contributing}${license}`;
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    elements.saveStatus.classList.add("saving");
    elements.saveStatus.innerHTML = "<i></i>Saving";
    saveTimer = setTimeout(() => {
      localStorage.setItem("readme-studio-state", JSON.stringify(state));
      elements.saveStatus.classList.remove("saving");
      elements.saveStatus.innerHTML = "<i></i>Saved locally";
    }, 300);
  }

  function render(save) {
    const markdown = Core.generateMarkdown(state);
    drawCover();
    elements.preview.innerHTML = previewSections();
    elements.markdown.textContent = markdown;
    elements.characterCount.textContent = `${markdown.length.toLocaleString()} chars`;
    elements.sectionCount.textContent = `${Core.sectionCount(markdown)} sections`;
    elements.preview.hidden = view !== "preview";
    elements.markdown.hidden = view !== "markdown";
    if (save) scheduleSave();
  }

  function readFormEvent(target) {
    if (target.dataset.field) state[target.dataset.field] = target.value;
    if (target.dataset.list === "features" || target.dataset.list === "roadmap") state[target.dataset.list] = normalizedLines(target.value);
    if (target.dataset.list === "stack") state.stack = String(target.value).split(",").map((item) => item.trim()).filter(Boolean);
    if (target.dataset.toggle) state.toggles[target.dataset.toggle] = target.checked;
  }

  function copyText(text) {
    const fallback = () => { const area = document.createElement("textarea"); area.value = text; area.style.position = "fixed"; area.style.opacity = "0"; document.body.appendChild(area); area.select(); document.execCommand("copy"); area.remove(); showToast("README copied"); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(() => showToast("README copied"), fallback); else fallback();
  }

  function downloadBlob(content, filename, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function downloadCover() {
    elements.canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a"); link.href = url; link.download = `${Core.slugify(state.name)}-cover.png`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 0);
    }, "image/png");
  }

  function setTheme(theme) {
    const selected = theme === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = selected;
    elements.theme.setAttribute("aria-label", selected === "dark" ? "Use light theme" : "Use dark theme");
    localStorage.setItem("readme-studio-theme", selected);
  }

  function bindEvents() {
    document.querySelector(".form-panel").addEventListener("input", (event) => {
      if (event.target === elements.accent) state.accent = elements.accent.value;
      else readFormEvent(event.target);
      render(true);
    });
    document.querySelectorAll("[data-template]").forEach((button) => button.addEventListener("click", () => { state = Core.template(button.dataset.template); syncForm(); render(true); }));
    document.querySelectorAll("[data-color]").forEach((button) => button.addEventListener("click", () => { state.accent = button.dataset.color; elements.accent.value = state.accent; render(true); }));
    document.querySelectorAll('[role="tab"]').forEach((tab) => {
      tab.addEventListener("click", () => {
        view = tab.dataset.view;
        document.querySelectorAll('[role="tab"]').forEach((item) => { const selected = item === tab; item.setAttribute("aria-selected", String(selected)); item.tabIndex = selected ? 0 : -1; });
        render(false);
      });
      tab.addEventListener("keydown", (event) => { if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return; event.preventDefault(); const tabs = Array.from(document.querySelectorAll('[role="tab"]')); const index = tabs.indexOf(tab); const next = event.key === "ArrowRight" ? (index + 1) % tabs.length : (index - 1 + tabs.length) % tabs.length; tabs[next].focus(); tabs[next].click(); });
    });
    elements.copy.addEventListener("click", () => copyText(Core.generateMarkdown(state)));
    elements.download.addEventListener("click", () => downloadBlob(Core.generateMarkdown(state), "README.md", "text/markdown;charset=utf-8"));
    elements.coverDownload.addEventListener("click", downloadCover);
    elements.reset.addEventListener("click", () => { state = Core.template("app"); syncForm(); render(true); showToast("Project reset"); });
    elements.theme.addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
  }

  try {
    const saved = JSON.parse(localStorage.getItem("readme-studio-state") || "null");
    if (saved && saved.name && saved.toggles) state = { ...Core.template(saved.template), ...saved, toggles: { ...Core.template(saved.template).toggles, ...saved.toggles } };
  } catch (_error) { localStorage.removeItem("readme-studio-state"); }
  setTheme(localStorage.getItem("readme-studio-theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  syncForm();
  bindEvents();
  render(false);
})();
