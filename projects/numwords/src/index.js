// numwords — integer to English words (UMD, zero dependencies).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.NumwordsTool = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const ONES = [
    "", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
    "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
    "seventeen", "eighteen", "nineteen",
  ];
  const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
  const SCALES = ["", "thousand", "million", "billion", "trillion", "quadrillion"];
  const LIMIT = 1000000000000000000n;

  // Render a 0–999 block. useAnd inserts "and" (e.g. British "one hundred and one").
  function threeDigits(n, useAnd) {
    let out = "";
    const h = Math.floor(n / 100);
    const r = n % 100;
    if (h) out += ONES[h] + " hundred";
    if (r) {
      if (h && useAnd) out += " and ";
      else if (h) out += " ";
      if (r < 20) out += ONES[r];
      else {
        const t = Math.floor(r / 10);
        const o = r % 10;
        out += TENS[t] + (o ? "-" + ONES[o] : "");
      }
    }
    return out.trim();
  }

  function toWords(input, opts) {
    const useAnd = opts && opts.useAnd !== undefined ? !!opts.useAnd : true;
    let num;
    if (typeof input === "bigint") {
      num = input;
    } else if (typeof input === "number") {
      if (!Number.isFinite(input) || !Number.isInteger(input)) throw new Error("请输入整数");
      if (!Number.isSafeInteger(input)) throw new Error("大整数请使用字符串输入，避免精度丢失");
      num = BigInt(input);
    } else if (typeof input === "string" && /^[+-]?\d+$/.test(input.trim())) {
      num = BigInt(input.trim());
    } else {
      throw new Error("请输入整数");
    }
    if (num === 0n) return "zero";
    if (num <= -LIMIT || num >= LIMIT) throw new Error("最大支持到 quadrillion 量级");

    const neg = num < 0n;
    let n = neg ? -num : num;
    const chunks = [];
    while (n > 0n) {
      chunks.push(Number(n % 1000n));
      n /= 1000n;
    }
    if (chunks.length > SCALES.length) throw new Error("number too large");

    const parts = [];
    for (let i = chunks.length - 1; i >= 0; i--) {
      const c = chunks[i];
      if (c === 0) continue;
      let s = threeDigits(c, useAnd);
      if (SCALES[i]) s += " " + SCALES[i];
      parts.push({ text: s, value: c });
    }
    // British-style "and" before the final small block (e.g. two million and one).
    if (useAnd && parts.length > 1 && parts[parts.length - 1].value < 100) {
      parts[parts.length - 1].text = "and " + parts[parts.length - 1].text;
    }
    let result = parts.map((p) => p.text).join(", ").replace(/, and /, " and ");
    if (neg) result = "negative " + result;
    return result;
  }

  return { toWords, SCALES };
});
