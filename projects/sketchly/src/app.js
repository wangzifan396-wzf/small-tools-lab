/**
 * Sketchly browser controller. Wires the pure core (geometry, scene,
 * store, render, theme) to the canvas and DOM declared in index.html.
 *
 * Loaded as an ES module in dev. The single-file build inlines this with
 * the other src/*.js modules (import/export lines stripped), so it must
 * contain no top-level await and no syntax a bundler would be required for.
 *
 * @module app
 */

import { Store } from './store.js';
import {
  screenToWorld,
  worldToScreen,
  hitTest,
  getBounds,
  normalizeBox,
  elementsInBox,
} from './geometry.js';
import {
  createElement,
  serializeScene,
  deserializeScene,
  resizeElement,
  translateElement,
} from './scene.js';
import { renderScene, renderElement } from './render.js';
import { getInitialTheme, applyTheme, toggleTheme } from './theme.js';

const $ = (id) => document.getElementById(id);

// ---- state ------------------------------------------------------------
const canvas = $('board');
const ctx = canvas.getContext('2d');
const store = new Store();

let elements = [];
let view = { x: 0, y: 0, zoom: 1 };
let tool = 'select';
let selectedIds = new Set();
let theme = getInitialTheme();

let action = 'idle'; // idle | creating | moving | resizing | panning | marquee
let draft = null;
let draftStart = null;
let moveStart = null;
let resizeHandle = null;
let resizeStart = null;
let panStart = null;
let marqueeStart = null;
let marqueeCur = null;
let editingId = null;
let spaceDown = false;

const history = [];
let hIndex = -1;

// style defaults (kept in sync with the toolbar inputs)
const styleInputs = {
  stroke: $('stroke'),
  fill: $('fill'),
  noFill: $('no-fill'),
  width: $('width'),
  rough: $('rough'),
  opacity: $('opacity'),
};

// ---- theme colors (canvas needs explicit values, not CSS vars) --------
function themeBg() {
  return theme === 'dark' ? '#1b1b1f' : '#fcfcfc';
}
function gridColor() {
  return theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
}
function selectionColor() {
  return theme === 'dark' ? '#5aa2ff' : '#4263eb';
}

// ---- helpers ----------------------------------------------------------
function getEl(id) {
  return elements.find((e) => e.id === id) || null;
}

function currentStyle() {
  return {
    stroke: styleInputs.stroke.value,
    fill: styleInputs.noFill.checked ? 'transparent' : styleInputs.fill.value,
    strokeWidth: Number(styleInputs.width.value),
    roughness: Number(styleInputs.rough.value),
    opacity: Number(styleInputs.opacity.value),
  };
}

function screenPoint(e) {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

function topmostAt(wp) {
  const threshold = 8 / view.zoom;
  for (let i = elements.length - 1; i >= 0; i--) {
    if (hitTest(elements[i], wp.x, wp.y, threshold)) return elements[i].id;
  }
  return null;
}

function handlePositions(box) {
  const { x, y, w, h } = box;
  return {
    n: { x: x + w / 2, y },
    s: { x: x + w / 2, y: y + h },
    e: { x: x + w, y: y + h / 2 },
    w: { x, y: y + h / 2 },
    ne: { x: x + w, y },
    nw: { x, y },
    se: { x: x + w, y: y + h },
    sw: { x, y: y + h },
  };
}

function hitHandle(sp) {
  if (selectedIds.size !== 1) return null;
  const el = getEl([...selectedIds][0]);
  if (!el) return null;
  const b = getBounds(el);
  const handles = handlePositions(b);
  for (const [name, pt] of Object.entries(handles)) {
    const s = worldToScreen(pt.x, pt.y, view);
    if (Math.abs(sp.x - s.x) <= 8 && Math.abs(sp.y - s.y) <= 8) return name;
  }
  return null;
}

function measureText(el) {
  const fontFamily = el.roughness > 0 ? '"Segoe Print","Comic Sans MS",cursive' : 'system-ui, sans-serif';
  ctx.font = `${el.fontSize || 20}px ${fontFamily}`;
  const lines = String(el.text || '').split('\n');
  let maxW = 0;
  for (const line of lines) maxW = Math.max(maxW, ctx.measureText(line).width);
  el.w = Math.max(maxW, 10);
  el.h = Math.max(lines.length * (el.fontSize || 20) * 1.25, (el.fontSize || 20) * 1.25);
}

function isDraftValid(d, type) {
  if (type === 'pen') return (d.points || []).length >= 1;
  if (type === 'line' || type === 'arrow') return Math.hypot(d.w || 0, d.h || 0) > 3;
  return Math.abs(d.w || 0) > 2 && Math.abs(d.h || 0) > 2;
}

function zoomAt(sp, factor) {
  const newZoom = Math.min(8, Math.max(0.1, view.zoom * factor));
  const before = screenToWorld(sp.x, sp.y, view);
  view.zoom = newZoom;
  view.x = sp.x - before.x * newZoom;
  view.y = sp.y - before.y * newZoom;
  render();
  scheduleSave();
}

function zoomAtCenter(factor) {
  zoomAt({ x: canvas.clientWidth / 2, y: canvas.clientHeight / 2 }, factor);
}

function zoomReset() {
  view = { x: 0, y: 0, zoom: 1 };
  render();
  scheduleSave();
}

// ---- history ----------------------------------------------------------
function pushHistory() {
  const snap = serializeScene({ elements, view });
  history.splice(hIndex + 1);
  history.push(snap);
  if (history.length > 100) history.shift();
  hIndex = history.length - 1;
}

function restore(snap) {
  const s = deserializeScene(snap);
  elements = s.elements;
  view = s.view;
  selectedIds = new Set();
  render();
  scheduleSave();
}

function undo() {
  if (hIndex > 0) {
    hIndex--;
    restore(history[hIndex]);
  }
}

function redo() {
  if (hIndex < history.length - 1) {
    hIndex++;
    restore(history[hIndex]);
  }
}

// ---- persistence (debounced) -----------------------------------------
let saveTimer = null;
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => store.save({ elements, view }), 500);
}

// ---- rendering --------------------------------------------------------
function drawGrid(w, h) {
  if (view.zoom < 0.3) return;
  const tl = screenToWorld(0, 0, view);
  const br = screenToWorld(w, h, view);
  const step = 24;
  ctx.fillStyle = gridColor();
  const startX = Math.floor(tl.x / step) * step;
  const startY = Math.floor(tl.y / step) * step;
  for (let gx = startX; gx < br.x; gx += step) {
    for (let gy = startY; gy < br.y; gy += step) {
      const s = worldToScreen(gx, gy, view);
      ctx.fillRect(s.x, s.y, 1, 1);
    }
  }
}

function drawSelection() {
  if (!selectedIds.size) return;
  ctx.save();
  ctx.strokeStyle = selectionColor();
  ctx.fillStyle = themeBg();
  ctx.lineWidth = 1;
  for (const id of selectedIds) {
    const el = getEl(id);
    if (!el) continue;
    const b = getBounds(el);
    const a = worldToScreen(b.x, b.y, view);
    const bw = b.w * view.zoom;
    const bh = b.h * view.zoom;
    ctx.strokeRect(a.x - 4, a.y - 4, bw + 8, bh + 8);
  }
  if (selectedIds.size === 1) {
    const el = getEl([...selectedIds][0]);
    const b = getBounds(el);
    const handles = handlePositions(b);
    for (const pt of Object.values(handles)) {
      const s = worldToScreen(pt.x, pt.y, view);
      ctx.fillRect(s.x - 4, s.y - 4, 8, 8);
      ctx.strokeRect(s.x - 4, s.y - 4, 8, 8);
    }
  }
  ctx.restore();
}

function render() {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = themeBg();
  ctx.fillRect(0, 0, w, h);
  drawGrid(w, h);

  ctx.save();
  ctx.translate(view.x, view.y);
  ctx.scale(view.zoom, view.zoom);
  renderScene(ctx, elements);
  if (draft) renderElement(ctx, draft);
  ctx.restore();

  drawSelection();

  if (action === 'marquee' && marqueeStart && marqueeCur) {
    const b = normalizeBox(marqueeStart.x, marqueeStart.y, marqueeCur.x - marqueeStart.x, marqueeCur.y - marqueeStart.y);
    ctx.save();
    ctx.strokeStyle = selectionColor();
    ctx.fillStyle = theme === 'dark' ? 'rgba(90,162,255,0.12)' : 'rgba(66,99,235,0.10)';
    ctx.lineWidth = 1;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.restore();
  }

  updateStatus();
}

function updateStatus() {
  const z = $('zoom-label');
  if (z) z.textContent = `${Math.round(view.zoom * 100)}%`;
  const st = $('status');
  if (st) {
    const toolName = { select: '选择', hand: '平移', pen: '画笔', rect: '矩形', ellipse: '椭圆', diamond: '菱形', arrow: '箭头', line: '直线', text: '文本' }[tool] || tool;
    st.textContent = `工具: ${toolName} · 已选 ${selectedIds.size} · 元素 ${elements.length}`;
  }
}

// ---- text editing overlay --------------------------------------------
const textEditor = $('text-editor');

function startTextEdit(el) {
  editingId = el.id;
  const sp = worldToScreen(el.x, el.y, view);
  textEditor.style.left = sp.x + 'px';
  textEditor.style.top = sp.y + 'px';
  textEditor.style.fontSize = Math.max(12, el.fontSize * view.zoom) + 'px';
  textEditor.style.color = el.stroke;
  textEditor.style.width = Math.max(80, el.w * view.zoom + 20) + 'px';
  textEditor.value = el.text;
  textEditor.style.display = 'block';
  textEditor.focus();
}

function startTextAt(wp) {
  const el = createElement('text', { x: wp.x, y: wp.y, text: '', fontSize: 20, ...currentStyle() });
  elements.push(el);
  selectedIds = new Set([el.id]);
  startTextEdit(el);
  render();
}

textEditor.addEventListener('input', () => {
  const el = getEl(editingId);
  if (!el) return;
  el.text = textEditor.value;
  measureText(el);
  render();
});

function commitText() {
  const el = getEl(editingId);
  if (el) {
    if (!el.text.trim()) {
      elements = elements.filter((e) => e.id !== el.id);
    } else {
      pushHistory();
    }
  }
  editingId = null;
  textEditor.style.display = 'none';
  render();
  scheduleSave();
}

textEditor.addEventListener('blur', commitText);
textEditor.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    e.preventDefault();
    textEditor.blur();
  } else if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    textEditor.blur();
  }
});

// ---- pointer interaction ---------------------------------------------
canvas.addEventListener('pointerdown', (e) => {
  if (editingId) textEditor.blur();
  canvas.setPointerCapture(e.pointerId);
  const sp = screenPoint(e);
  const wp = screenToWorld(sp.x, sp.y, view);

  if (e.button === 1 || spaceDown || tool === 'hand') {
    action = 'panning';
    panStart = { x: sp.x, y: sp.y, vx: view.x, vy: view.y };
    return;
  }

  if (tool === 'select') {
    const h = hitHandle(sp);
    if (h && selectedIds.size === 1) {
      action = 'resizing';
      resizeHandle = h;
      resizeStart = { wp };
      return;
    }
    const hitId = topmostAt(wp);
    if (hitId) {
      if (e.shiftKey) {
        if (selectedIds.has(hitId)) selectedIds.delete(hitId);
        else selectedIds.add(hitId);
      } else if (!selectedIds.has(hitId)) {
        selectedIds = new Set([hitId]);
      }
      action = 'moving';
      moveStart = { last: wp };
      render();
      return;
    }
    if (!e.shiftKey) selectedIds = new Set();
    action = 'marquee';
    marqueeStart = sp;
    marqueeCur = sp;
    render();
    return;
  }

  if (tool === 'text') {
    startTextAt(wp);
    return;
  }

  // drawing tools
  action = 'creating';
  draftStart = wp;
  draft = createElement(tool, { x: wp.x, y: wp.y, w: 0, h: 0, ...currentStyle() });
  if (tool === 'pen') draft.points = [[wp.x, wp.y]];
  render();
});

canvas.addEventListener('pointermove', (e) => {
  const sp = screenPoint(e);
  const wp = screenToWorld(sp.x, sp.y, view);

  if (action === 'panning') {
    view.x = panStart.vx + (sp.x - panStart.x);
    view.y = panStart.vy + (sp.y - panStart.y);
    render();
    scheduleSave();
    return;
  }
  if (action === 'creating') {
    if (tool === 'pen') {
      draft.points.push([wp.x, wp.y]);
      const b = getBounds(draft);
      draft.x = b.x;
      draft.y = b.y;
      draft.w = b.w;
      draft.h = b.h;
    } else {
      draft.w = wp.x - draftStart.x;
      draft.h = wp.y - draftStart.y;
    }
    render();
    return;
  }
  if (action === 'moving') {
    const dx = wp.x - moveStart.last.x;
    const dy = wp.y - moveStart.last.y;
    for (const id of selectedIds) {
      const el = getEl(id);
      if (el) translateElement(el, dx, dy);
    }
    moveStart.last = wp;
    render();
    return;
  }
  if (action === 'resizing') {
    const el = getEl([...selectedIds][0]);
    if (el) {
      const dx = wp.x - resizeStart.wp.x;
      const dy = wp.y - resizeStart.wp.y;
      resizeElement(el, resizeHandle, dx, dy);
      resizeStart.wp = wp;
    }
    render();
    return;
  }
  if (action === 'marquee') {
    marqueeCur = sp;
    render();
    return;
  }
});

function endPointer(e) {
  try {
    canvas.releasePointerCapture(e.pointerId);
  } catch {
    /* ignore */
  }
  if (action === 'creating') {
    if (isDraftValid(draft, tool)) {
      elements.push(draft);
      selectedIds = new Set([draft.id]);
      pushHistory();
    }
    draft = null;
    action = 'idle';
    render();
    scheduleSave();
    return;
  }
  if (action === 'moving' || action === 'resizing') {
    pushHistory();
    action = 'idle';
    render();
    scheduleSave();
    return;
  }
  if (action === 'marquee') {
    const box = normalizeBox(
      marqueeStart.x,
      marqueeStart.y,
      marqueeCur.x - marqueeStart.x,
      marqueeCur.y - marqueeStart.y
    );
    const wb = {
      x: screenToWorld(box.x, box.y, view).x,
      y: screenToWorld(box.x, box.y, view).y,
      w: box.w / view.zoom,
      h: box.h / view.zoom,
    };
    const found = elementsInBox(elements, wb).map((el) => el.id);
    selectedIds = new Set(found);
    action = 'idle';
    marqueeCur = null;
    render();
    return;
  }
  action = 'idle';
}

canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);

canvas.addEventListener('dblclick', (e) => {
  const sp = screenPoint(e);
  const wp = screenToWorld(sp.x, sp.y, view);
  const id = topmostAt(wp);
  if (id) {
    const el = getEl(id);
    if (el && el.type === 'text') {
      selectedIds = new Set([id]);
      startTextEdit(el);
    }
  }
});

canvas.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      zoomAt(screenPoint(e), Math.exp(-e.deltaY * 0.0015));
    } else {
      view.x -= e.deltaX;
      view.y -= e.deltaY;
      render();
      scheduleSave();
    }
  },
  { passive: false }
);

// ---- selection / deletion --------------------------------------------
function deleteSelected() {
  if (!selectedIds.size) return;
  elements = elements.filter((e) => !selectedIds.has(e.id));
  selectedIds = new Set();
  pushHistory();
  render();
  scheduleSave();
}

function applyStyleToSelection() {
  if (!selectedIds.size) return;
  const s = currentStyle();
  for (const id of selectedIds) {
    const el = getEl(id);
    if (!el) continue;
    el.stroke = s.stroke;
    if (el.type !== 'text') {
      el.fill = s.fill;
      el.strokeWidth = s.strokeWidth;
      el.roughness = s.roughness;
    }
    el.opacity = s.opacity;
  }
  pushHistory();
  render();
}

// ---- export / import --------------------------------------------------
function downloadText(filename, text, mime) {
  const blob = new Blob([text], { type: mime + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportPNG() {
  if (!elements.length) {
    window.alert('画布为空，没有可导出的内容。');
    return;
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const el of elements) {
    const b = getBounds(el);
    minX = Math.min(minX, b.minX);
    minY = Math.min(minY, b.minY);
    maxX = Math.max(maxX, b.maxX);
    maxY = Math.max(maxY, b.maxY);
  }
  const pad = 40;
  const scale = 2;
  const w = maxX - minX + pad * 2;
  const h = maxY - minY + pad * 2;
  const c = document.createElement('canvas');
  c.width = Math.round(w * scale);
  c.height = Math.round(h * scale);
  const cx = c.getContext('2d');
  cx.setTransform(scale, 0, 0, scale, 0, 0);
  cx.fillStyle = themeBg();
  cx.fillRect(0, 0, w, h);
  cx.save();
  cx.translate(-minX + pad, -minY + pad);
  renderScene(cx, elements);
  cx.restore();
  c.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sketchly.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}

function exportJSON() {
  downloadText('sketchly.json', serializeScene({ elements, view }), 'application/json');
}

function importJSON(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const s = deserializeScene(String(reader.result));
      elements = s.elements;
      view = s.view;
      selectedIds = new Set();
      pushHistory();
      render();
      scheduleSave();
    } catch (err) {
      window.alert('导入失败: ' + err.message);
    }
  };
  reader.readAsText(file);
}

function clearAll() {
  if (!elements.length) return;
  if (!window.confirm('清空整个画布？此操作可以撤销（Ctrl+Z）。')) return;
  elements = [];
  selectedIds = new Set();
  pushHistory();
  render();
  scheduleSave();
}

// ---- toolbar / inputs -------------------------------------------------
function setTool(t) {
  tool = t;
  document.querySelectorAll('[data-tool]').forEach((b) => {
    b.classList.toggle('active', b.getAttribute('data-tool') === t);
  });
  canvas.style.cursor =
    t === 'hand' ? 'grab' : t === 'select' ? 'default' : t === 'text' ? 'text' : 'crosshair';
  updateStatus();
}

function wireUI() {
  document.querySelectorAll('[data-tool]').forEach((b) => {
    b.addEventListener('click', () => setTool(b.getAttribute('data-tool')));
  });
  $('undo').addEventListener('click', undo);
  $('redo').addEventListener('click', redo);
  $('zoom-in').addEventListener('click', () => zoomAtCenter(1.1));
  $('zoom-out').addEventListener('click', () => zoomAtCenter(1 / 1.1));
  $('zoom-reset').addEventListener('click', zoomReset);
  $('export-png').addEventListener('click', exportPNG);
  $('export-json').addEventListener('click', exportJSON);
  $('clear').addEventListener('click', clearAll);
  $('theme-toggle').addEventListener('click', () => {
    theme = toggleTheme();
    render();
  });

  const imp = $('import');
  imp.addEventListener('change', () => {
    if (imp.files && imp.files[0]) importJSON(imp.files[0]);
    imp.value = '';
  });

  ['stroke', 'fill', 'no-fill', 'width', 'rough', 'opacity'].forEach((k) => {
    styleInputs[k].addEventListener('input', applyStyleToSelection);
  });
}

// ---- keyboard ---------------------------------------------------------
window.addEventListener('keydown', (e) => {
  if (editingId) return;
  const tag = e.target && e.target.tagName;
  if (tag === 'INPUT' && e.target.type !== 'range' && e.target.type !== 'color') return;
  if (tag === 'TEXTAREA') return;

  const mod = e.ctrlKey || e.metaKey;
  const key = e.key.toLowerCase();

  if (mod && key === 'z') {
    e.preventDefault();
    e.shiftKey ? redo() : undo();
    return;
  }
  if (mod && key === 'y') {
    e.preventDefault();
    redo();
    return;
  }
  if (mod && key === 'a') {
    e.preventDefault();
    selectedIds = new Set(elements.map((el) => el.id));
    render();
    return;
  }
  if (key === 'delete' || key === 'backspace') {
    e.preventDefault();
    deleteSelected();
    return;
  }
  if (key === ' ') {
    spaceDown = true;
    canvas.style.cursor = 'grab';
    return;
  }
  if (!mod) {
    const map = {
      v: 'select', h: 'hand', p: 'pen', r: 'rect', o: 'ellipse',
      d: 'diamond', a: 'arrow', l: 'line', t: 'text',
    };
    if (map[key]) setTool(map[key]);
    if (key === '+' || key === '=') zoomAtCenter(1.1);
    if (key === '-' || key === '_') zoomAtCenter(1 / 1.1);
    if (key === '0') zoomReset();
  }
  if (key === 'escape') {
    if (draft) {
      draft = null;
      action = 'idle';
    }
    selectedIds = new Set();
    render();
  }
});

window.addEventListener('keyup', (e) => {
  if (e.key === ' ') {
    spaceDown = false;
    canvas.style.cursor = tool === 'hand' ? 'grab' : tool === 'select' ? 'default' : 'crosshair';
  }
});

window.addEventListener('resize', render);

// ---- boot -------------------------------------------------------------
function seedWelcome() {
  if (elements.length) return;
  const t = createElement('text', {
    x: -40, y: -120, text: '欢迎使用 Sketchly ✦\n选上方工具开始画，双击任意处加文字', fontSize: 24,
  });
  measureText(t);
  elements.push(t);
}

function init() {
  applyTheme(theme);
  theme = document.documentElement.getAttribute('data-theme') || 'light';
  wireUI();
  setTool('select');

  const loaded = store.load();
  elements = loaded.elements;
  view = loaded.view;
  seedWelcome();
  pushHistory();
  render();
}

init();
