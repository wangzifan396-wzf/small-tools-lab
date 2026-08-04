(function initializeChromaCraft() {
  "use strict";

  const Color = window.ColorUtils;
  const supportedImageTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
  const elements = {
    canvas: document.querySelector("#image-canvas"),
    clearButton: document.querySelector("#clear-button"),
    codeOutput: document.querySelector("#code-output"),
    colorCount: document.querySelector("#color-count"),
    colorCountOutput: document.querySelector("#color-count-output"),
    contrastWrap: document.querySelector("#contrast-wrap"),
    copyButton: document.querySelector("#copy-button"),
    downloadButton: document.querySelector("#download-button"),
    dropZone: document.querySelector("#drop-zone"),
    emptyState: document.querySelector("#empty-state"),
    extractButton: document.querySelector("#extract-button"),
    fileInput: document.querySelector("#file-input"),
    ignoreLight: document.querySelector("#ignore-light"),
    boostChroma: document.querySelector("#boost-chroma"),
    imageMeta: document.querySelector("#image-meta"),
    paletteEmpty: document.querySelector("#palette-empty"),
    paletteGrid: document.querySelector("#palette-grid"),
    previewDots: document.querySelector("#preview-dots"),
    previewShell: document.querySelector("#preview-shell"),
    sampleButton: document.querySelector("#sample-button"),
    shareButton: document.querySelector("#share-button"),
    themeToggle: document.querySelector("#theme-toggle"),
    toast: document.querySelector("#toast"),
    uploadButton: document.querySelector("#upload-button")
  };

  const state = {
    source: null,
    sourceName: "",
    originalWidth: 0,
    originalHeight: 0,
    sampled: 0,
    palette: [],
    format: "css"
  };
  let toastTimer = 0;

  function showToast(message) {
    window.clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.add("visible");
    toastTimer = window.setTimeout(() => elements.toast.classList.remove("visible"), 2200);
  }

  function setTheme(theme) {
    const selected = theme === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = selected;
    elements.themeToggle.setAttribute("aria-label", selected === "dark" ? "Use light theme" : "Use dark theme");
    document.querySelector('meta[name="theme-color"]').content = selected === "dark" ? "#131718" : "#f4f6f2";
    localStorage.setItem("chromacraft-theme", selected);
  }

  function restoreTheme() {
    const saved = localStorage.getItem("chromacraft-theme");
    const preferred = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    setTheme(saved || preferred);
  }

  function persistState() {
    const saved = {
      palette: state.palette,
      colorCount: Number(elements.colorCount.value),
      trimNearWhite: elements.ignoreLight.checked,
      boostChroma: elements.boostChroma.checked
    };
    localStorage.setItem("chromacraft-state", JSON.stringify(saved));
  }

  function restoreState() {
    try {
      const saved = JSON.parse(localStorage.getItem("chromacraft-state") || "null");
      if (!saved) return;
      const colors = Array.isArray(saved.palette) ? saved.palette : [];
      state.palette = colors
        .map((color) => ({ hex: Color.normalizeHex(color.hex), locked: Boolean(color.locked) }))
        .filter((color) => color.hex);
      if (Number.isFinite(saved.colorCount)) elements.colorCount.value = String(Math.min(10, Math.max(3, saved.colorCount)));
      if (typeof saved.trimNearWhite === "boolean") elements.ignoreLight.checked = saved.trimNearWhite;
      if (typeof saved.boostChroma === "boolean") elements.boostChroma.checked = saved.boostChroma;
    } catch (_error) {
      localStorage.removeItem("chromacraft-state");
    }
  }

  function readPaletteFromHash() {
    const match = window.location.hash.match(/^#palette=([0-9a-f-]+)$/i);
    if (!match) return false;
    const colors = match[1].split("-").map((hex) => Color.normalizeHex(hex)).filter(Boolean).slice(0, 10);
    if (colors.length < 2) return false;
    state.palette = colors.map((hex) => ({ hex, locked: false }));
    elements.colorCount.value = String(Math.max(3, colors.length));
    return true;
  }

  function updateImageMeta() {
    const values = elements.imageMeta.querySelectorAll("dd");
    values[0].textContent = state.source ? `${state.originalWidth} x ${state.originalHeight}` : "-";
    values[1].textContent = state.sampled ? state.sampled.toLocaleString() : "-";
  }

  function drawSource(source, name, width, height) {
    const maxDimension = 1400;
    const scale = Math.min(1, maxDimension / Math.max(width, height));
    const drawWidth = Math.max(1, Math.round(width * scale));
    const drawHeight = Math.max(1, Math.round(height * scale));
    const context = elements.canvas.getContext("2d", { willReadFrequently: true });

    elements.canvas.width = drawWidth;
    elements.canvas.height = drawHeight;
    context.clearRect(0, 0, drawWidth, drawHeight);
    context.drawImage(source, 0, 0, drawWidth, drawHeight);
    elements.canvas.hidden = false;
    elements.emptyState.hidden = true;

    state.source = source;
    state.sourceName = name;
    state.originalWidth = width;
    state.originalHeight = height;
    state.sampled = 0;
    elements.extractButton.disabled = false;
    updateImageMeta();
  }

  function createSampleCanvas() {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 760;
    const context = canvas.getContext("2d");

    context.fillStyle = "#D8D6D0";
    context.fillRect(0, 0, canvas.width, canvas.height);
    for (let index = 0; index < 5200; index += 1) {
      const gray = 186 + ((index * 47) % 44);
      context.fillStyle = `rgba(${gray}, ${gray}, ${gray - 3}, 0.08)`;
      context.fillRect((index * 83) % canvas.width, (index * 137) % canvas.height, 2, 2);
    }

    context.save();
    context.shadowColor = "rgba(37, 43, 45, 0.24)";
    context.shadowBlur = 30;
    context.shadowOffsetY = 16;
    context.fillStyle = "#64528F";
    context.translate(815, 520);
    context.rotate(-0.08);
    context.fillRect(-205, -105, 410, 210);
    context.strokeStyle = "rgba(255,255,255,0.22)";
    context.lineWidth = 3;
    for (let y = -95; y < 105; y += 13) {
      context.beginPath();
      context.moveTo(-200, y);
      context.lineTo(200, y);
      context.stroke();
    }
    context.restore();

    context.save();
    context.shadowColor = "rgba(37, 43, 45, 0.24)";
    context.shadowBlur = 28;
    context.shadowOffsetY = 14;
    context.translate(780, 285);
    context.rotate(0.1);
    context.fillStyle = "#D75546";
    context.fillRect(-175, -112, 350, 224);
    context.fillStyle = "#B73F34";
    context.fillRect(-175, -112, 22, 224);
    context.strokeStyle = "rgba(255,255,255,0.5)";
    context.lineWidth = 2;
    context.strokeRect(-162, -99, 324, 198);
    context.restore();

    context.save();
    context.shadowColor = "rgba(37, 43, 45, 0.28)";
    context.shadowBlur = 26;
    context.shadowOffsetY = 13;
    context.fillStyle = "#174F88";
    context.beginPath();
    context.arc(300, 330, 118, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#123A64";
    context.beginPath();
    context.arc(300, 330, 82, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#7A4B2C";
    context.beginPath();
    context.arc(300, 330, 68, 0, Math.PI * 2);
    context.fill();
    context.lineWidth = 30;
    context.strokeStyle = "#174F88";
    context.beginPath();
    context.arc(414, 342, 55, -1.25, 1.25);
    context.stroke();
    context.restore();

    context.save();
    context.translate(345, 590);
    context.rotate(-0.24);
    context.shadowColor = "rgba(37, 43, 45, 0.2)";
    context.shadowBlur = 15;
    context.shadowOffsetY = 9;
    context.fillStyle = "#E5AF31";
    context.fillRect(-210, -13, 420, 26);
    context.fillStyle = "#D55B47";
    context.fillRect(170, -13, 40, 26);
    context.fillStyle = "#D5B58E";
    context.beginPath();
    context.moveTo(-250, 0);
    context.lineTo(-210, -13);
    context.lineTo(-210, 13);
    context.closePath();
    context.fill();
    context.fillStyle = "#2B3030";
    context.beginPath();
    context.moveTo(-250, 0);
    context.lineTo(-236, -5);
    context.lineTo(-236, 5);
    context.closePath();
    context.fill();
    context.restore();

    context.save();
    context.translate(1005, 178);
    context.rotate(0.45);
    context.shadowColor = "rgba(37, 43, 45, 0.25)";
    context.shadowBlur = 20;
    context.shadowOffsetY = 10;
    context.fillStyle = "#2F7254";
    context.beginPath();
    context.moveTo(0, -105);
    context.bezierCurveTo(115, -55, 110, 52, 0, 122);
    context.bezierCurveTo(-100, 58, -110, -50, 0, -105);
    context.fill();
    context.strokeStyle = "#E2DAB0";
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(0, -86);
    context.lineTo(0, 100);
    context.stroke();
    context.restore();

    context.save();
    context.translate(1050, 620);
    context.rotate(-0.38);
    context.strokeStyle = "#272D2F";
    context.lineWidth = 16;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(-52, -55);
    context.lineTo(52, 55);
    context.moveTo(-25, -80);
    context.lineTo(78, 28);
    context.stroke();
    context.restore();

    return canvas;
  }

  function loadSample() {
    const sample = createSampleCanvas();
    drawSource(sample, "chromacraft-sample", sample.width, sample.height);
    extractPalette();
  }

  function loadFile(file) {
    if (!file || !supportedImageTypes.has(file.type)) {
      showToast("Choose a supported image file");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      showToast("Image must be smaller than 25 MB");
      return;
    }

    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      drawSource(image, file.name.replace(/\.[^.]+$/, "") || "palette", image.naturalWidth, image.naturalHeight);
      URL.revokeObjectURL(url);
      extractPalette();
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      showToast("The image could not be decoded");
    };
    image.src = url;
  }

  function extractPalette() {
    if (!state.source) return;
    elements.extractButton.disabled = true;
    elements.extractButton.textContent = "Extracting...";

    window.requestAnimationFrame(() => {
      try {
        const context = elements.canvas.getContext("2d", { willReadFrequently: true });
        const imageData = context.getImageData(0, 0, elements.canvas.width, elements.canvas.height);
        const lockedColors = state.palette.filter((color) => color.locked).map((color) => color.hex);
        const result = Color.quantizeImageData(imageData, Number(elements.colorCount.value), {
          lockedColors,
          trimNearWhite: elements.ignoreLight.checked,
          boostChroma: elements.boostChroma.checked,
          maxSamples: 18000
        });
        if (!result.colors.length) {
          showToast("No opaque pixels were available");
          return;
        }
        state.palette = result.colors;
        state.sampled = result.sampled;
        renderAll();
        updateImageMeta();
        persistState();
      } catch (error) {
        console.error(error);
        showToast("Palette extraction failed");
      } finally {
        elements.extractButton.disabled = false;
        elements.extractButton.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/><circle cx="12" cy="12" r="4"/></svg>Extract palette';
      }
    });
  }

  function copyText(text, message) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => showToast(message)).catch(() => fallbackCopy(text, message));
    } else {
      fallbackCopy(text, message);
    }
  }

  function fallbackCopy(text, message) {
    const input = document.createElement("textarea");
    input.value = text;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.appendChild(input);
    input.select();
    const copied = document.execCommand("copy");
    input.remove();
    showToast(copied ? message : "Copy was unavailable");
  }

  function paletteItemTemplate(color, index) {
    const textColor = Color.chooseTextColor(color.hex);
    return `
      <article class="swatch-card" role="listitem" style="--swatch:${color.hex};--swatch-text:${textColor}">
        <div class="swatch-color">
          <span class="swatch-order">${String(index + 1).padStart(2, "0")}</span>
          <button class="swatch-lock" type="button" data-action="lock" data-index="${index}" aria-pressed="${color.locked}" aria-label="${color.locked ? "Unlock" : "Lock"} ${color.hex}" title="${color.locked ? "Unlock color" : "Lock color"}">
            <svg class="locked" aria-hidden="true" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <svg class="unlocked" aria-hidden="true" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.5-2"/></svg>
          </button>
        </div>
        <div class="swatch-data">
          <input type="color" value="${color.hex}" data-action="picker" data-index="${index}" aria-label="Edit color ${index + 1}">
          <input class="hex-input" value="${color.hex}" maxlength="7" data-action="hex" data-index="${index}" aria-label="Hex value for color ${index + 1}" spellcheck="false">
          <button class="copy-swatch" type="button" data-action="copy" data-index="${index}" aria-label="Copy ${color.hex}" title="Copy hex">
            <svg aria-hidden="true" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </button>
        </div>
      </article>`;
  }

  function renderPalette() {
    const hasPalette = state.palette.length > 0;
    elements.paletteEmpty.hidden = hasPalette;
    elements.paletteGrid.hidden = !hasPalette;
    elements.paletteGrid.innerHTML = state.palette.map(paletteItemTemplate).join("");
    elements.clearButton.disabled = !hasPalette;
    elements.shareButton.disabled = !hasPalette;
    elements.copyButton.disabled = !hasPalette;
    elements.downloadButton.disabled = !hasPalette;
  }

  function renderContrast() {
    if (!state.palette.length) {
      elements.contrastWrap.innerHTML = '<div class="analysis-empty">Palette required</div>';
      return;
    }

    const headers = state.palette.map((color, index) => `<th scope="col">FG ${index + 1}<br>${color.hex}</th>`).join("");
    const rows = state.palette.map((background, rowIndex) => {
      const cells = state.palette.map((foreground) => {
        const ratio = Color.contrastRatio(background.hex, foreground.hex);
        const status = ratio >= 4.5 ? "AA" : ratio >= 3 ? "AA large" : "Fail";
        return `<td class="contrast-cell" style="--background:${background.hex};--foreground:${foreground.hex}" aria-label="${foreground.hex} on ${background.hex}: ${ratio.toFixed(2)} to 1, ${status}"><strong>Aa</strong><span>${ratio.toFixed(2)}:1</span><small>${status}</small></td>`;
      }).join("");
      return `<tr><th scope="row">BG ${rowIndex + 1}<br>${background.hex}</th>${cells}</tr>`;
    }).join("");

    elements.contrastWrap.innerHTML = `<table class="contrast-table"><caption class="sr-only">Foreground and background WCAG contrast ratios</caption><thead><tr><th scope="col">BG / FG</th>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
  }

  function renderPreview() {
    if (!state.palette.length) {
      elements.previewShell.removeAttribute("style");
      elements.previewDots.innerHTML = "";
      return;
    }

    const sorted = [...state.palette].sort((a, b) => Color.relativeLuminance(a.hex) - Color.relativeLuminance(b.hex));
    const text = sorted[0].hex;
    const background = sorted[sorted.length - 1].hex;
    const surface = sorted.length > 2 ? sorted[sorted.length - 2].hex : background;
    const primary = sorted[Math.max(1, Math.floor((sorted.length - 1) / 2))].hex;
    const accent = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.7))].hex;
    const line = Color.contrastRatio(surface, text) > 3 ? text : primary;
    const style = {
      "--preview-bg": background,
      "--preview-surface": surface,
      "--preview-text": text,
      "--preview-muted": text,
      "--preview-primary": primary,
      "--preview-primary-text": Color.chooseTextColor(primary),
      "--preview-accent": accent,
      "--preview-line": `${line}55`
    };
    Object.entries(style).forEach(([property, value]) => elements.previewShell.style.setProperty(property, value));
    elements.previewDots.innerHTML = state.palette.map((color) => `<i style="background:${color.hex}" title="${color.hex}"></i>`).join("");
  }

  function renderOutput() {
    elements.codeOutput.textContent = state.palette.length ? Color.exportTokens(state.palette, state.format) : "/* Palette required */";
  }

  function renderAll() {
    elements.colorCountOutput.value = elements.colorCount.value;
    renderPalette();
    renderContrast();
    renderPreview();
    renderOutput();
  }

  function updateColor(index, value) {
    const normalized = Color.normalizeHex(value);
    if (!normalized || !state.palette[index]) {
      showToast("Enter a valid hex color");
      renderPalette();
      return;
    }
    state.palette[index].hex = normalized;
    renderAll();
    persistState();
  }

  function handlePaletteClick(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const index = Number(button.dataset.index);
    const color = state.palette[index];
    if (!color) return;

    if (button.dataset.action === "lock") {
      color.locked = !color.locked;
      renderPalette();
      persistState();
    }
    if (button.dataset.action === "copy") copyText(color.hex, `${color.hex} copied`);
  }

  function handlePaletteInput(event) {
    const input = event.target;
    if (input.dataset.action === "picker") updateColor(Number(input.dataset.index), input.value);
  }

  function handlePaletteChange(event) {
    const input = event.target;
    if (input.dataset.action === "hex") updateColor(Number(input.dataset.index), input.value);
  }

  function clearPalette() {
    state.palette = [];
    state.sampled = 0;
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    renderAll();
    updateImageMeta();
    persistState();
  }

  function sharePalette() {
    const encoded = state.palette.map((color) => color.hex.slice(1)).join("-");
    window.location.hash = `palette=${encoded}`;
    copyText(window.location.href, "Palette link copied");
  }

  function downloadTokens() {
    const extensions = { css: "css", json: "json", tailwind: "js" };
    const blob = new Blob([elements.codeOutput.textContent + "\n"], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${state.sourceName || "chromacraft-palette"}.${extensions[state.format]}`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function handleDrop(event) {
    event.preventDefault();
    elements.dropZone.classList.remove("dragging");
    const file = Array.from(event.dataTransfer.files).find((item) => supportedImageTypes.has(item.type));
    loadFile(file);
  }

  function bindEvents() {
    elements.uploadButton.addEventListener("click", () => elements.fileInput.click());
    elements.fileInput.addEventListener("change", () => loadFile(elements.fileInput.files[0]));
    elements.sampleButton.addEventListener("click", loadSample);
    elements.extractButton.addEventListener("click", extractPalette);
    elements.clearButton.addEventListener("click", clearPalette);
    elements.shareButton.addEventListener("click", sharePalette);
    elements.copyButton.addEventListener("click", () => copyText(elements.codeOutput.textContent, "Tokens copied"));
    elements.downloadButton.addEventListener("click", downloadTokens);
    elements.themeToggle.addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
    elements.colorCount.addEventListener("input", () => {
      elements.colorCountOutput.value = elements.colorCount.value;
    });
    elements.colorCount.addEventListener("change", () => {
      if (state.source) extractPalette();
      else persistState();
    });
    [elements.ignoreLight, elements.boostChroma].forEach((control) => {
      control.addEventListener("change", () => state.source ? extractPalette() : persistState());
    });

    elements.paletteGrid.addEventListener("click", handlePaletteClick);
    elements.paletteGrid.addEventListener("input", handlePaletteInput);
    elements.paletteGrid.addEventListener("change", handlePaletteChange);

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
        const current = tabs.indexOf(tab);
        const targets = {
          ArrowLeft: (current - 1 + tabs.length) % tabs.length,
          ArrowRight: (current + 1) % tabs.length,
          Home: 0,
          End: tabs.length - 1
        };
        if (!(event.key in targets)) return;
        event.preventDefault();
        tabs[targets[event.key]].focus();
        tabs[targets[event.key]].click();
      });
    });

    ["dragenter", "dragover"].forEach((name) => elements.dropZone.addEventListener(name, (event) => {
      event.preventDefault();
      elements.dropZone.classList.add("dragging");
    }));
    ["dragleave", "dragend"].forEach((name) => elements.dropZone.addEventListener(name, () => elements.dropZone.classList.remove("dragging")));
    elements.dropZone.addEventListener("drop", handleDrop);
    elements.dropZone.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        elements.fileInput.click();
      }
    });
    window.addEventListener("paste", (event) => {
      const file = Array.from(event.clipboardData.files).find((item) => supportedImageTypes.has(item.type));
      if (file) loadFile(file);
    });
    window.addEventListener("hashchange", () => {
      if (readPaletteFromHash()) {
        renderAll();
        persistState();
      }
    });
  }

  restoreTheme();
  restoreState();
  const openedSharedPalette = readPaletteFromHash();
  bindEvents();
  renderAll();
  if (!openedSharedPalette && !state.palette.length) loadSample();
})();
