// radix — zero-dependency number base converter.
//
// Converts between arbitrary bases (2..36) using BigInt so very large values
// stay exact. Also renders binary / octal / decimal / hex and a bit & byte
// view. No dependencies, runs in Node and the browser.

export const MAX_BASE = 36;
const DIGITS = "0123456789abcdefghijklmnopqrstuvwxyz";

export function alphabetFor(base) {
  if (!Number.isInteger(base) || base < 2 || base > MAX_BASE) return null;
  return DIGITS.slice(0, base);
}

export function isValidInput(str, base) {
  if (!Number.isInteger(base) || base < 2 || base > MAX_BASE) return false;
  const s = String(str == null ? "" : str).trim().toLowerCase();
  if (!s) return false;
  const body = s.startsWith("-") ? s.slice(1) : s;
  if (!body) return false;
  const alpha = alphabetFor(base);
  for (const ch of body) {
    if (alpha.indexOf(ch) === -1) return false;
  }
  return true;
}

// Parse `str` in `fromBase` into a BigInt (sign preserved).
export function toDecimal(str, fromBase) {
  const s = String(str == null ? "" : str).trim().toLowerCase();
  if (!isValidInput(s, fromBase)) throw new Error(`invalid input "${str}" for base ${fromBase}`);
  const negative = s.startsWith("-");
  const body = negative ? s.slice(1) : s;
  let acc = 0n;
  for (const ch of body) {
    acc = acc * BigInt(fromBase) + BigInt(DIGITS.indexOf(ch));
  }
  return negative ? -acc : acc;
}

// Format a BigInt `value` in `toBase`.
export function fromDecimal(value, toBase) {
  if (!Number.isInteger(toBase) || toBase < 2 || toBase > MAX_BASE) {
    throw new Error(`invalid base ${toBase}`);
  }
  let n = typeof value === "bigint" ? value : BigInt(value);
  const negative = n < 0n;
  n = negative ? -n : n;
  if (n === 0n) return "0";
  let out = "";
  while (n > 0n) {
    out = DIGITS[Number(n % BigInt(toBase))] + out;
    n = n / BigInt(toBase);
  }
  return negative ? "-" + out : out;
}

// Convert `str` from `fromBase` to `toBase`.
export function convert(str, fromBase, toBase) {
  const dec = toDecimal(str, fromBase);
  const value = fromDecimal(dec, toBase);
  return {
    input: String(str).trim(),
    fromBase,
    toBase,
    decimal: dec.toString(),
    value,
    negative: dec < 0n,
    unsignedValue: dec < 0n ? (-dec).toString() : dec.toString(),
  };
}

// Show the value in the four common bases.
export function commonConversions(str, fromBase) {
  const dec = toDecimal(str, fromBase);
  return {
    binary: fromDecimal(dec, 2),
    octal: fromDecimal(dec, 8),
    decimal: dec.toString(),
    hex: fromDecimal(dec, 16),
  };
}

// Binary + byte-aligned view of the (unsigned) magnitude.
export function bitView(str, fromBase) {
  const dec = toDecimal(str, fromBase);
  const mag = dec < 0n ? -dec : dec;
  const binary = mag === 0n ? "0" : fromDecimal(mag, 2);
  const bits = binary.length;
  const byteLength = Math.ceil(bits / 8);
  const padded = binary.padStart(byteLength * 8, "0");
  const bytes = [];
  for (let i = 0; i < padded.length; i += 8) bytes.push(padded.slice(i, i + 8));
  return { binary, bits, byteLength, bytes };
}
