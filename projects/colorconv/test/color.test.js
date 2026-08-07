import test from 'node:test';
import assert from 'node:assert/strict';
import { formatHsl, formatRgb, hslToRgb, normalizeHue, parseColor, parseHex, parseHsl, parseRgb, rgbToHex, rgbToHsl } from '../src/index.js';

test('parseHex supports short, long, and alpha forms', () => {
  assert.deepEqual(parseHex('#f03'), { r: 255, g: 0, b: 51, a: 1 });
  assert.deepEqual(parseHex('336699'), { r: 51, g: 102, b: 153, a: 1 });
  assert.deepEqual(parseHex('#00000080'), { r: 0, g: 0, b: 0, a: 0.502 });
});

test('parseRgb accepts numbers, percentages, and alpha', () => {
  assert.deepEqual(parseRgb('rgb(255, 0, 128)'), { r: 255, g: 0, b: 128, a: 1 });
  assert.deepEqual(parseRgb('rgb(100% 0% 50% / 25%)'), { r: 255, g: 0, b: 127, a: 0.25 });
});

test('parseRgb rejects out-of-range and missing channels', () => {
  assert.throws(() => parseRgb('rgb(300, 0, 0)'), /between/);
  assert.throws(() => parseRgb('rgb(1, 2)'), /three channels/);
});

test('HSL primary colors convert to reference RGB values', () => {
  assert.deepEqual(hslToRgb({ h: 0, s: 100, l: 50 }), { r: 255, g: 0, b: 0, a: 1 });
  assert.deepEqual(parseHsl('hsl(120 100% 50%)'), { r: 0, g: 255, b: 0, a: 1 });
  assert.deepEqual(parseHsl('hsl(240, 100%, 50%, 0.5)'), { r: 0, g: 0, b: 255, a: 0.5 });
});

test('normalizeHue wraps positive and negative rotations', () => {
  assert.equal(normalizeHue(720), 0);
  assert.equal(normalizeHue(-30), 330);
});

test('rgbToHex handles case and alpha options', () => {
  assert.equal(rgbToHex({ r: 255, g: 0, b: 51, a: 1 }), '#ff0033');
  assert.equal(rgbToHex({ r: 255, g: 0, b: 51, a: 0.5 }, { uppercase: true }), '#FF003380');
});

test('rgbToHsl matches red and gray references', () => {
  assert.deepEqual(rgbToHsl({ r: 255, g: 0, b: 0, a: 1 }), { h: 0, s: 100, l: 50, a: 1 });
  assert.deepEqual(rgbToHsl({ r: 128, g: 128, b: 128, a: 1 }), { h: 0, s: 0, l: 50.2, a: 1 });
});

test('formatters produce CSS-compatible values', () => {
  assert.equal(formatRgb({ r: 1, g: 2, b: 3, a: 1 }), 'rgb(1, 2, 3)');
  assert.equal(formatRgb({ r: 1, g: 2, b: 3, a: 0.5 }), 'rgba(1, 2, 3, 0.5)');
  assert.equal(formatHsl({ r: 255, g: 0, b: 0, a: 1 }), 'hsl(0, 100%, 50%)');
});

test('parseColor dispatches supported formats and rejects unknown input', () => {
  assert.equal(parseColor('#fff').r, 255);
  assert.equal(parseColor('rgb(1 2 3)').g, 2);
  assert.equal(parseColor('hsl(0 100% 50%)').r, 255);
  assert.throws(() => parseColor('blue'), /Unsupported/);
  assert.throws(() => parseColor(''), /empty/);
});
