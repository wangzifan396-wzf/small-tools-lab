/**
 * Rule registry and presets.
 *
 * @module rules
 */

import timingRules from './timing.js';
import layoutRules from './layout.js';
import cjkRules from './cjk.js';

/** @type {import('../core/lint.js').Rule[]} */
export const allRules = [...timingRules, ...layoutRules, ...cjkRules];

/** @type {Map<string, import('../core/lint.js').Rule>} */
export const ruleMap = new Map(allRules.map((rule) => [rule.id, rule]));

/**
 * The order autofixes run in. Text normalisation happens before re-wrapping,
 * and re-wrapping before timing repair, so each stage sees clean input from
 * the one before it.
 * @type {string[]}
 */
export const fixOrder = [
  'no-markup',
  'trailing-whitespace',
  'no-fullwidth-latin',
  'no-cjk-space',
  'cjk-punctuation-width',
  'cjk-latin-spacing',
  'ellipsis-style',
  'no-line-end-period',
  'no-empty-cue',
  'no-duplicate-adjacent',
  // Line-count first, then width — the width pass runs last so it always has
  // the final say on how a cue is broken.
  'max-lines',
  'max-line-width',
  'cjk-line-start',
  'negative-time',
  'no-overlap',
  'min-gap',
  'min-duration',
];

/**
 * @typedef {Record<string, import('../core/lint.js').Severity | [import('../core/lint.js').Severity, Record<string, any>]>} PresetRules
 */

/** @type {Record<string, { description: string, rules: PresetRules }>} */
export const presets = {
  recommended: {
    description: 'Balanced defaults. Catches real problems without nagging.',
    rules: {
      'no-markup': 'off',
      'gap-too-long': 'off',
    },
  },

  strict: {
    description: 'Everything on, tighter thresholds. Good for a CI gate.',
    rules: {
      'no-markup': 'warn',
      'gap-too-long': ['info', { max: 20000 }],
      'max-cps': ['error', { cjkCps: 8, latinCps: 17 }],
      'min-duration': ['error', { min: 1000 }],
      'max-duration': ['error', { max: 6000 }],
      'max-line-width': ['error', { max: 38 }],
      'max-lines': ['error', { max: 2 }],
      'min-gap': ['warn', { min: 120 }],
      'no-line-end-period': 'warn',
      'ellipsis-style': 'warn',
    },
  },

  loose: {
    description: 'Only things that actually break playback.',
    rules: {
      'max-cps': 'off',
      'min-duration': 'off',
      'max-duration': 'off',
      'min-gap': 'off',
      'max-lines': 'off',
      'max-line-width': 'off',
      'no-markup': 'off',
      'gap-too-long': 'off',
      'trailing-whitespace': 'off',
      'ellipsis-style': 'off',
      'no-line-end-period': 'off',
      'cjk-latin-spacing': 'off',
      'cjk-punctuation-width': 'off',
      'no-fullwidth-latin': 'off',
      'no-cjk-space': 'off',
      'cjk-line-start': 'off',
      'no-duplicate-adjacent': 'off',
    },
  },

  cjk: {
    description: 'Tuned for Chinese, Japanese and Korean subtitles.',
    rules: {
      'max-line-width': ['warn', { max: 32 }], // 16 full-width characters
      'max-cps': ['warn', { cjkCps: 9, latinCps: 20 }],
      'min-duration': ['warn', { min: 1000 }],
      'cjk-latin-spacing': 'warn',
      'cjk-punctuation-width': 'error',
      'no-fullwidth-latin': 'warn',
      'no-cjk-space': 'error',
      'cjk-line-start': 'warn',
      'no-line-end-period': 'warn',
      'ellipsis-style': 'warn',
      'no-markup': 'off',
      'gap-too-long': 'off',
    },
  },

  netflix: {
    description: 'Approximates the Netflix timed-text style guide.',
    rules: {
      'max-line-width': ['error', { max: 42 }],
      'max-lines': ['error', { max: 2 }],
      'min-duration': ['error', { min: 833 }],
      'max-duration': ['error', { max: 7000 }],
      'min-gap': ['error', { min: 84 }],
      'max-cps': ['error', { cjkCps: 9, latinCps: 20 }],
      'no-markup': 'off',
      'gap-too-long': 'off',
      'cjk-latin-spacing': 'off',
      'cjk-punctuation-width': 'off',
      'no-line-end-period': 'off',
      'ellipsis-style': 'off',
    },
  },
};

export const defaultPreset = 'recommended';
