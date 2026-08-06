// Zero-dependency unit conversion across common physical / digital categories.
// Each non-temperature category maps every unit to a factor relative to a base
// unit; conversion is then a two-step scale (to base, then from base).
// Temperature is handled specially because of its offset.

export const CATEGORIES = {
  length: {
    base: 'm',
    units: {
      mm: 0.001, cm: 0.01, m: 1, km: 1000,
      in: 0.0254, ft: 0.3048, yd: 0.9144, mi: 1609.344, nmi: 1852
    }
  },
  mass: {
    base: 'g',
    units: {
      mg: 0.001, g: 1, kg: 1000, t: 1e6,
      oz: 28.349523125, lb: 453.59237, st: 6350.29318
    }
  },
  temperature: {
    base: 'C',
    special: true,
    units: { C: 1, F: 1, K: 1 }
  },
  speed: {
    base: 'm/s',
    units: {
      'm/s': 1, 'km/h': 0.2777777777777778, mph: 0.44704, 'ft/s': 0.3048, knot: 0.5144444444444445
    }
  },
  data: {
    base: 'B',
    units: {
      bit: 0.125, B: 1, KB: 1000, MB: 1e6, GB: 1e9, TB: 1e12,
      KiB: 1024, MiB: 1048576, GiB: 1073741824, TiB: 1099511627776
    }
  },
  time: {
    base: 's',
    units: { ms: 0.001, s: 1, min: 60, h: 3600, d: 86400, wk: 604800 }
  },
  area: {
    base: 'm2',
    units: {
      'mm2': 1e-6, 'cm2': 1e-4, m2: 1, 'km2': 1e6, ha: 1e4,
      acre: 4046.8564224, 'ft2': 0.09290304, 'in2': 0.00064516
    }
  },
  volume: {
    base: 'L',
    units: {
      mL: 0.001, L: 1, 'm3': 1000, gal: 3.785411784, qt: 0.946352946,
      cup: 0.2365882365, 'fl oz': 0.0295735295625
    }
  },
  energy: {
    base: 'J',
    units: { J: 1, kJ: 1000, cal: 4.184, kcal: 4184, Wh: 3600, kWh: 3.6e6, eV: 1.602176634e-19 }
  },
  pressure: {
    base: 'Pa',
    units: { Pa: 1, kPa: 1000, bar: 1e5, atm: 101325, psi: 6894.757293168, mmHg: 133.322387415 }
  }
};

export function listCategories() {
  return Object.keys(CATEGORIES);
}

export function unitsInCategory(category) {
  const c = CATEGORIES[category];
  return c ? Object.keys(c.units) : [];
}

// Which category (if any) a unit symbol belongs to.
export function categoryOf(unit) {
  const u = String(unit || '').trim();
  for (const [cat, c] of Object.entries(CATEGORIES)) {
    if (u in c.units) return cat;
  }
  return null;
}

export function findUnit(unit) {
  const symbol = String(unit || '').trim();
  const cat = categoryOf(symbol);
  return cat ? { category: cat, symbol } : null;
}

function toKelvin(value, from) {
  if (from === 'C') return value + 273.15;
  if (from === 'F') return (value - 32) * 5 / 9 + 273.15;
  if (from === 'K') return value;
  throw new Error('未知温度单位: ' + from);
}

function fromKelvin(kelvin, to) {
  if (to === 'C') return kelvin - 273.15;
  if (to === 'F') return (kelvin - 273.15) * 9 / 5 + 32;
  if (to === 'K') return kelvin;
  throw new Error('未知温度单位: ' + to);
}

// Convert a numeric value from one unit to another. Throws on unknown units or
// mismatched categories. Returns a plain number (callers decide formatting).
export function convert(value, from, to) {
  const v = Number(value);
  if (!Number.isFinite(v)) throw new Error('数值无效: ' + value);
  from = String(from || '').trim();
  to = String(to || '').trim();

  const catFrom = categoryOf(from);
  const catTo = categoryOf(to);
  if (!catFrom) throw new Error('未知单位: ' + from + '（用 --list 查看所有单位）');
  if (!catTo) throw new Error('未知单位: ' + to + '（用 --list 查看所有单位）');
  if (catFrom !== catTo) {
    throw new Error(`单位不属于同一类别：${from}（${catFrom}）与 ${to}（${catTo}）`);
  }

  const cat = CATEGORIES[catFrom];
  if (cat.special) return fromKelvin(toKelvin(v, from), to);

  const base = v * cat.units[from];
  return base / cat.units[to];
}

// Trim trailing zeros / limit significant digits for clean CLI output.
export function formatNumber(n) {
  if (!Number.isFinite(n)) return String(n);
  if (n === 0) return '0';
  const abs = Math.abs(n);
  let s;
  if (abs !== 0 && (abs < 1e-4 || abs >= 1e15)) s = n.toExponential(6);
  else s = n.toPrecision(10);
  // strip trailing zeros after the decimal point
  if (s.indexOf('.') !== -1 && s.indexOf('e') === -1) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return s;
}

// Convenience: returns { value, unit } with a formatted string.
export function convertWithUnit(value, from, to) {
  const result = convert(value, from, to);
  return { value: result, unit: to, formatted: formatNumber(result) + ' ' + to };
}
