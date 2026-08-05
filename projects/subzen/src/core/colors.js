/**
 * Minimal ANSI colouring. No dependency, honours `NO_COLOR` and `FORCE_COLOR`.
 *
 * @module core/colors
 */

const CODES = {
  reset: [0, 0],
  bold: [1, 22],
  dim: [2, 22],
  italic: [3, 23],
  underline: [4, 24],
  inverse: [7, 27],
  black: [30, 39],
  red: [31, 39],
  green: [32, 39],
  yellow: [33, 39],
  blue: [34, 39],
  magenta: [35, 39],
  cyan: [36, 39],
  white: [37, 39],
  gray: [90, 39],
  bgRed: [41, 49],
  bgYellow: [43, 49],
  bgGreen: [42, 49],
  bgBlue: [44, 49],
};

/**
 * @param {{ tty?: boolean, env?: Record<string, string|undefined> }} [context]
 * @returns {boolean}
 */
export function supportsColor(context = {}) {
  const env = context.env ?? (typeof process !== 'undefined' ? process.env : {}) ?? {};
  if (env.NO_COLOR !== undefined && env.NO_COLOR !== '') return false;
  if (env.FORCE_COLOR !== undefined && env.FORCE_COLOR !== '0') return true;
  if (env.TERM === 'dumb') return false;
  if (context.tty !== undefined) return context.tty;
  return typeof process !== 'undefined' && Boolean(process.stdout?.isTTY);
}

/**
 * Build a colour palette. Every helper is a plain `string => string`.
 * @param {boolean} [enabled]
 * @returns {Record<keyof typeof CODES, (text: string) => string>}
 */
export function createColors(enabled = supportsColor()) {
  /** @type {any} */
  const palette = {};
  for (const [name, [open, close]] of Object.entries(CODES)) {
    palette[name] = enabled
      ? /** @param {string} text */ (text) => `\u001b[${open}m${text}\u001b[${close}m`
      : /** @param {string} text */ (text) => text;
  }
  return palette;
}

/** Strip ANSI escapes — used when measuring column widths. */
export function stripAnsi(text) {
  // eslint-disable-next-line no-control-regex
  return String(text ?? '').replace(/\u001b\[[0-9;]*m/g, '');
}
