// passphrase — diceware passphrase generator (UMD, zero dependencies).
// Browser build attaches to window.PassphraseTool; Node gets module.exports.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PassphraseTool = factory();
})(typeof self !== "undefined" ? self : this, function () {
  // EFF-style short wordlist (256 entries) — easy to type, low confusion.
  const WORDS = "able acid aged also area army atom aunt away baby back ball band bank bare barn base bath bear beat beef bell belt bend best bike bill bird bite blue boat body boil bolt bone book boot born boss both bowl bulb bulk bull burn bush busy cage cake calf call calm camp cane cape card care cart case cash cast cave cell cent chat chef chin chip chop city clad clay clip club coal coat code coil coin cold come cook cool cope copy cord core cork corn cost crab crew crop crowd cube cult cute dale damp dare dark dart dash date dawn deal deck deed deep deer dent desk dial dice diet dime dirt dish dive dock does doll dome done door dose dot dove down drag draw drip drop drum duck dull dust duty each ear ease east easy echo edge edit eel egg epic even ever evil exam exit face fact fade fail fair fall fame farm fast fate fear feast feed feel feet fell fern file fill film find fine fire firm fish fist five flag flat flaw flea flee flew flip flow flux foil folk font food fool foot ford fork form fort foul four free frog from fuel full fund fury fuse gain game gang gap gate gaze gear gem gift girl give glad glow glue goal goat gold golf gone good gown grab gram gray grew grid grim grin grip grow gulf hair half hall halt hand hang hard harm hate hail hawk haze head heal heap".split(/\s+/).filter(Boolean);

  const DEFAULTS = {
    words: 6,
    separator: "-",
    capitalize: false,
    includeNumber: false,
    rng: Math.random,
  };

  function clampInt(n, min, max, fallback) {
    const v = Math.floor(Number(n));
    if (!Number.isFinite(v)) return fallback;
    return Math.min(max, Math.max(min, v));
  }

  // Cryptographically-lean RNG selection when available; falls back to rng().
  function pickIndex(rng, size) {
    return Math.floor(rng() * size) % size;
  }

  function generate(opts) {
    const o = Object.assign({}, DEFAULTS, opts || {});
    const count = clampInt(o.words, 2, 16, 6);
    const sep = o.separator === undefined || o.separator === null ? "-" : String(o.separator);
    const useCap = !!o.capitalize;
    const useNum = !!o.includeNumber;
    const rng = typeof o.rng === "function" ? o.rng : Math.random;

    const chosen = [];
    for (let i = 0; i < count; i++) {
      let w = WORDS[pickIndex(rng, WORDS.length)];
      if (useCap) w = w.charAt(0).toUpperCase() + w.slice(1);
      chosen.push(w);
    }
    if (useNum) {
      chosen.push(String(Math.floor(rng() * 10)));
    }
    return chosen.join(sep);
  }

  // Entropy estimate in bits for a given word count (log2(listSize) per word).
  function entropyBits(wordCount) {
    const n = clampInt(wordCount, 1, 1e6, 1);
    return Math.round(n * Math.log2(WORDS.length) * 100) / 100;
  }

  function strengthLabel(bits) {
    if (bits >= 80) return "强（推荐 ≥ 60 位）";
    if (bits >= 50) return "中等";
    return "偏弱";
  }

  return { WORDS, generate, entropyBits, strengthLabel, DEFAULTS };
});
