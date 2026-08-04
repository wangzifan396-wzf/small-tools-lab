(function attachColorUtils(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ColorUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createColorUtils() {
  "use strict";

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function normalizeHex(value) {
    if (typeof value !== "string") return null;
    const raw = value.trim().replace(/^#/, "");
    if (/^[0-9a-f]{3}$/i.test(raw)) {
      return `#${raw.split("").map((part) => part + part).join("")}`.toUpperCase();
    }
    if (!/^[0-9a-f]{6}$/i.test(raw)) return null;
    return `#${raw.toUpperCase()}`;
  }

  function hexToRgb(value) {
    const hex = normalizeHex(value);
    if (!hex) return null;
    return {
      r: parseInt(hex.slice(1, 3), 16),
      g: parseInt(hex.slice(3, 5), 16),
      b: parseInt(hex.slice(5, 7), 16)
    };
  }

  function rgbToHex(rgb) {
    const parts = [rgb.r, rgb.g, rgb.b].map((channel) => {
      return Math.round(clamp(Number(channel) || 0, 0, 255)).toString(16).padStart(2, "0");
    });
    return `#${parts.join("")}`.toUpperCase();
  }

  function srgbToLinear(channel) {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }

  function linearToSrgb(channel) {
    const value = channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055;
    return clamp(value * 255, 0, 255);
  }

  function relativeLuminance(color) {
    const rgb = typeof color === "string" ? hexToRgb(color) : color;
    if (!rgb) return 0;
    return 0.2126 * srgbToLinear(rgb.r) + 0.7152 * srgbToLinear(rgb.g) + 0.0722 * srgbToLinear(rgb.b);
  }

  function contrastRatio(first, second) {
    const a = relativeLuminance(first);
    const b = relativeLuminance(second);
    const lighter = Math.max(a, b);
    const darker = Math.min(a, b);
    return (lighter + 0.05) / (darker + 0.05);
  }

  function chooseTextColor(background, light) {
    const lightColor = light || "#FFFFFF";
    const darkRatio = contrastRatio(background, "#111414");
    const lightRatio = contrastRatio(background, lightColor);
    return darkRatio >= lightRatio ? "#111414" : normalizeHex(lightColor);
  }

  function rgbToOklab(rgb) {
    const r = srgbToLinear(rgb.r);
    const g = srgbToLinear(rgb.g);
    const b = srgbToLinear(rgb.b);

    const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
    const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
    const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
    const lRoot = Math.cbrt(l);
    const mRoot = Math.cbrt(m);
    const sRoot = Math.cbrt(s);

    return {
      l: 0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot,
      a: 1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot,
      b: 0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot
    };
  }

  function oklabToRgb(lab) {
    const lRoot = lab.l + 0.3963377774 * lab.a + 0.2158037573 * lab.b;
    const mRoot = lab.l - 0.1055613458 * lab.a - 0.0638541728 * lab.b;
    const sRoot = lab.l - 0.0894841775 * lab.a - 1.291485548 * lab.b;
    const l = lRoot ** 3;
    const m = mRoot ** 3;
    const s = sRoot ** 3;

    return {
      r: linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
      g: linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
      b: linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)
    };
  }

  function labDistanceSquared(first, second) {
    const dl = first.l - second.l;
    const da = first.a - second.a;
    const db = first.b - second.b;
    return dl * dl + da * da + db * db;
  }

  function collectSamples(imageData, options) {
    const settings = options || {};
    const maxSamples = settings.maxSamples || 16000;
    const totalPixels = imageData.width * imageData.height;
    const stride = Math.max(1, Math.floor(Math.sqrt(totalPixels / maxSamples)));
    const samples = [];

    for (let y = 0; y < imageData.height; y += stride) {
      for (let x = 0; x < imageData.width; x += stride) {
        const offset = (y * imageData.width + x) * 4;
        const alpha = imageData.data[offset + 3];
        if (alpha < 128) continue;

        const rgb = {
          r: imageData.data[offset],
          g: imageData.data[offset + 1],
          b: imageData.data[offset + 2]
        };
        const maximum = Math.max(rgb.r, rgb.g, rgb.b);
        const minimum = Math.min(rgb.r, rgb.g, rgb.b);
        if (settings.trimNearWhite && minimum > 244 && maximum - minimum < 8) continue;

        const lab = rgbToOklab(rgb);
        const chroma = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
        const weight = settings.boostChroma ? 1 + Math.min(2.2, chroma * 9) : 1;
        samples.push({ rgb, lab, weight });
      }
    }

    return { samples, stride };
  }

  function weightedMean(samples) {
    const result = { l: 0, a: 0, b: 0 };
    let total = 0;
    for (const sample of samples) {
      result.l += sample.lab.l * sample.weight;
      result.a += sample.lab.a * sample.weight;
      result.b += sample.lab.b * sample.weight;
      total += sample.weight;
    }
    if (!total) return result;
    result.l /= total;
    result.a /= total;
    result.b /= total;
    return result;
  }

  function farthestSample(samples, centroids) {
    let winner = samples[0];
    let winnerScore = -1;
    for (const sample of samples) {
      let nearest = Infinity;
      for (const centroid of centroids) {
        nearest = Math.min(nearest, labDistanceSquared(sample.lab, centroid.lab));
      }
      const score = nearest * sample.weight;
      if (score > winnerScore) {
        winner = sample;
        winnerScore = score;
      }
    }
    return winner;
  }

  function quantizeImageData(imageData, requestedCount, options) {
    if (!imageData || !imageData.data || !imageData.width || !imageData.height) {
      return { colors: [], sampled: 0, stride: 1 };
    }

    const settings = options || {};
    const desiredCount = clamp(Math.round(requestedCount || 6), 1, 16);
    const collected = collectSamples(imageData, settings);
    const samples = collected.samples;
    if (!samples.length) return { colors: [], sampled: 0, stride: collected.stride };

    const locked = (settings.lockedColors || [])
      .map(normalizeHex)
      .filter(Boolean)
      .slice(0, desiredCount);
    const centroids = locked.map((hex) => ({ lab: rgbToOklab(hexToRgb(hex)), locked: true, hex }));

    if (!centroids.length) centroids.push({ lab: weightedMean(samples), locked: false });
    while (centroids.length < desiredCount) {
      const sample = farthestSample(samples, centroids);
      centroids.push({ lab: { ...sample.lab }, locked: false });
    }

    for (let iteration = 0; iteration < 14; iteration += 1) {
      const sums = centroids.map(() => ({ l: 0, a: 0, b: 0, weight: 0 }));
      for (const sample of samples) {
        let nearestIndex = 0;
        let nearestDistance = Infinity;
        centroids.forEach((centroid, index) => {
          const distance = labDistanceSquared(sample.lab, centroid.lab);
          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestIndex = index;
          }
        });
        const target = sums[nearestIndex];
        target.l += sample.lab.l * sample.weight;
        target.a += sample.lab.a * sample.weight;
        target.b += sample.lab.b * sample.weight;
        target.weight += sample.weight;
      }

      let movement = 0;
      centroids.forEach((centroid, index) => {
        if (centroid.locked) return;
        const sum = sums[index];
        if (!sum.weight) {
          centroid.lab = { ...farthestSample(samples, centroids).lab };
          return;
        }
        const next = {
          l: sum.l / sum.weight,
          a: sum.a / sum.weight,
          b: sum.b / sum.weight
        };
        movement += labDistanceSquared(centroid.lab, next);
        centroid.lab = next;
      });
      if (movement < 0.0000001) break;
    }

    const colors = centroids.map((centroid) => {
      const hex = centroid.locked ? centroid.hex : rgbToHex(oklabToRgb(centroid.lab));
      return { hex, locked: centroid.locked };
    });
    colors.sort((a, b) => relativeLuminance(a.hex) - relativeLuminance(b.hex));

    return { colors, sampled: samples.length, stride: collected.stride };
  }

  function tokenMap(colors) {
    return colors.reduce((tokens, color, index) => {
      tokens[`color-${index + 1}`] = normalizeHex(color.hex || color);
      return tokens;
    }, {});
  }

  function exportTokens(colors, format) {
    const tokens = tokenMap(colors);
    if (format === "json") return JSON.stringify({ colors: tokens }, null, 2);
    if (format === "tailwind") {
      const lines = Object.entries(tokens).map(([name, value]) => `        '${name}': '${value}'`).join(",\n");
      return `/** @type {import('tailwindcss').Config} */\nmodule.exports = {\n  theme: {\n    extend: {\n      colors: {\n${lines}\n      }\n    }\n  }\n};`;
    }
    const lines = Object.entries(tokens).map(([name, value]) => `  --${name}: ${value};`).join("\n");
    return `:root {\n${lines}\n}`;
  }

  return {
    chooseTextColor,
    contrastRatio,
    exportTokens,
    hexToRgb,
    normalizeHex,
    oklabToRgb,
    quantizeImageData,
    relativeLuminance,
    rgbToHex,
    rgbToOklab,
    tokenMap
  };
});
