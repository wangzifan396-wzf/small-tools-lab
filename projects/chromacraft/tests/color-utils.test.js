"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Color = require("../src/color-utils.js");

function imageDataFromBands(colors, widthPerBand, height) {
  const width = colors.length * widthPerBand;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const color = Color.hexToRgb(colors[Math.floor(x / widthPerBand)]);
      const offset = (y * width + x) * 4;
      data[offset] = color.r;
      data[offset + 1] = color.g;
      data[offset + 2] = color.b;
      data[offset + 3] = 255;
    }
  }
  return { data, width, height };
}

test("normalizes short and long hex colors", () => {
  assert.equal(Color.normalizeHex("abc"), "#AABBCC");
  assert.equal(Color.normalizeHex(" #1f6f6a "), "#1F6F6A");
  assert.equal(Color.normalizeHex("not-a-color"), null);
});

test("converts between RGB and hex", () => {
  assert.deepEqual(Color.hexToRgb("#D65B48"), { r: 214, g: 91, b: 72 });
  assert.equal(Color.rgbToHex({ r: 214.2, g: 90.8, b: 72 }), "#D65B48");
});

test("calculates WCAG reference contrast ratios", () => {
  assert.equal(Color.contrastRatio("#000000", "#FFFFFF"), 21);
  assert.ok(Math.abs(Color.contrastRatio("#777777", "#FFFFFF") - 4.478) < 0.01);
  assert.equal(Color.chooseTextColor("#FFFFFF"), "#111414");
  assert.equal(Color.chooseTextColor("#111111"), "#FFFFFF");
});

test("round trips representative colors through OKLab", () => {
  for (const hex of ["#000000", "#FFFFFF", "#D65B48", "#317C73", "#174F88"]) {
    const rgb = Color.hexToRgb(hex);
    const restored = Color.oklabToRgb(Color.rgbToOklab(rgb));
    assert.ok(Math.abs(restored.r - rgb.r) < 0.01, `${hex} red channel`);
    assert.ok(Math.abs(restored.g - rgb.g) < 0.01, `${hex} green channel`);
    assert.ok(Math.abs(restored.b - rgb.b) < 0.01, `${hex} blue channel`);
  }
});

test("extracts deterministic perceptual clusters", () => {
  const image = imageDataFromBands(["#D84F43", "#1A5A91", "#E6B536"], 20, 20);
  const first = Color.quantizeImageData(image, 3, { maxSamples: 5000 });
  const second = Color.quantizeImageData(image, 3, { maxSamples: 5000 });
  assert.deepEqual(first.colors, second.colors);
  assert.equal(first.colors.length, 3);
  for (const expected of ["#D84F43", "#1A5A91", "#E6B536"]) {
    assert.ok(first.colors.some((color) => Color.contrastRatio(color.hex, expected) < 1.01), expected);
  }
});

test("keeps locked colors during reclustering", () => {
  const image = imageDataFromBands(["#D84F43", "#1A5A91", "#E6B536"], 12, 12);
  const result = Color.quantizeImageData(image, 3, { lockedColors: ["#7B3FB4"] });
  assert.ok(result.colors.some((color) => color.hex === "#7B3FB4" && color.locked));
});

test("exports stable CSS, JSON, and Tailwind token formats", () => {
  const colors = [{ hex: "#172123" }, { hex: "#D65B48" }];
  assert.match(Color.exportTokens(colors, "css"), /--color-1: #172123;/);
  assert.deepEqual(JSON.parse(Color.exportTokens(colors, "json")), {
    colors: { "color-1": "#172123", "color-2": "#D65B48" }
  });
  assert.match(Color.exportTokens(colors, "tailwind"), /'color-2': '#D65B48'/);
});
