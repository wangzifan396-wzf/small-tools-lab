function round(value, digits = 0) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function inRange(value, min, max, label) {
  if (!Number.isFinite(value) || value < min || value > max) throw new RangeError(`${label} must be between ${min} and ${max}`);
  return value;
}

function alpha(value) {
  const input = String(value).trim();
  return input.endsWith('%') ? inRange(Number.parseFloat(input), 0, 100, 'Alpha') / 100 : inRange(Number(input), 0, 1, 'Alpha');
}

export function parseHex(value) {
  const match = String(value).trim().match(/^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/iu);
  if (!match) throw new SyntaxError('Invalid HEX color');
  let hex = match[1];
  if (hex.length <= 4) hex = [...hex].map((digit) => digit.repeat(2)).join('');
  return { r: Number.parseInt(hex.slice(0, 2), 16), g: Number.parseInt(hex.slice(2, 4), 16), b: Number.parseInt(hex.slice(4, 6), 16), a: hex.length === 8 ? round(Number.parseInt(hex.slice(6, 8), 16) / 255, 4) : 1 };
}

function rgbChannel(value) {
  const input = String(value).trim();
  return input.endsWith('%') ? round(inRange(Number.parseFloat(input), 0, 100, 'RGB percentage') * 2.55) : inRange(Number(input), 0, 255, 'RGB channel');
}

export function parseRgb(value) {
  const match = String(value).trim().match(/^rgba?\((.*)\)$/iu);
  if (!match) throw new SyntaxError('Invalid RGB color');
  const parts = match[1].trim().split(/[\s,/]+/u).filter(Boolean);
  if (parts.length < 3 || parts.length > 4) throw new SyntaxError('RGB requires three channels and optional alpha');
  return { r: rgbChannel(parts[0]), g: rgbChannel(parts[1]), b: rgbChannel(parts[2]), a: parts[3] == null ? 1 : alpha(parts[3]) };
}

export function normalizeHue(value) {
  const hue = Number(value);
  if (!Number.isFinite(hue)) throw new TypeError('Hue must be finite');
  return ((hue % 360) + 360) % 360;
}

export function hslToRgb({ h, s, l, a = 1 }) {
  const hue = normalizeHue(h) / 360;
  const saturation = inRange(Number(s), 0, 100, 'Saturation') / 100;
  const lightness = inRange(Number(l), 0, 100, 'Lightness') / 100;
  inRange(Number(a), 0, 1, 'Alpha');
  if (saturation === 0) {
    const channel = Math.round(lightness * 255);
    return { r: channel, g: channel, b: channel, a: Number(a) };
  }
  const q = lightness < 0.5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation;
  const p = 2 * lightness - q;
  const convert = (offset) => {
    let t = hue + offset;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return { r: Math.round(convert(1 / 3) * 255), g: Math.round(convert(0) * 255), b: Math.round(convert(-1 / 3) * 255), a: Number(a) };
}

export function parseHsl(value) {
  const match = String(value).trim().match(/^hsla?\((.*)\)$/iu);
  if (!match) throw new SyntaxError('Invalid HSL color');
  const parts = match[1].trim().split(/[\s,/]+/u).filter(Boolean);
  if (parts.length < 3 || parts.length > 4 || !parts[1].endsWith('%') || !parts[2].endsWith('%')) throw new SyntaxError('HSL requires hue and two percentages');
  return hslToRgb({ h: Number(parts[0]), s: Number.parseFloat(parts[1]), l: Number.parseFloat(parts[2]), a: parts[3] == null ? 1 : alpha(parts[3]) });
}

export function parseColor(value) {
  const input = String(value ?? '').trim();
  if (!input) throw new SyntaxError('Color input is empty');
  if (input.startsWith('#') || /^[0-9a-f]{3,8}$/iu.test(input)) return parseHex(input);
  if (/^rgba?\(/iu.test(input)) return parseRgb(input);
  if (/^hsla?\(/iu.test(input)) return parseHsl(input);
  throw new SyntaxError('Unsupported color format; use HEX, RGB, or HSL');
}

export function rgbToHex(color, options = {}) {
  const { includeAlpha = color.a != null && color.a < 1, uppercase = false } = options;
  const channel = (value) => Math.round(inRange(Number(value), 0, 255, 'RGB channel')).toString(16).padStart(2, '0');
  let output = `#${channel(color.r)}${channel(color.g)}${channel(color.b)}`;
  if (includeAlpha) output += channel(inRange(Number(color.a ?? 1), 0, 1, 'Alpha') * 255);
  return uppercase ? output.toUpperCase() : output;
}

export function rgbToHsl(color) {
  let r = inRange(Number(color.r), 0, 255, 'Red') / 255;
  let g = inRange(Number(color.g), 0, 255, 'Green') / 255;
  let b = inRange(Number(color.b), 0, 255, 'Blue') / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  let hue = 0;
  let saturation = 0;
  if (max !== min) {
    const delta = max - min;
    saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    if (max === r) hue = (g - b) / delta + (g < b ? 6 : 0);
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
    hue /= 6;
  }
  return { h: round(hue * 360, 1), s: round(saturation * 100, 1), l: round(lightness * 100, 1), a: Number(color.a ?? 1) };
}

export function formatRgb(color) {
  const channels = [color.r, color.g, color.b].map((value) => Math.round(inRange(Number(value), 0, 255, 'RGB channel')));
  const a = inRange(Number(color.a ?? 1), 0, 1, 'Alpha');
  return a < 1 ? `rgba(${channels.join(', ')}, ${round(a, 3)})` : `rgb(${channels.join(', ')})`;
}

export function formatHsl(color) {
  const hsl = rgbToHsl(color);
  return hsl.a < 1 ? `hsla(${hsl.h}, ${hsl.s}%, ${hsl.l}%, ${round(hsl.a, 3)})` : `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
}
