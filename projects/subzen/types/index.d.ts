/**
 * Type definitions for subzen.
 *
 * The library is authored as JSDoc-annotated ESM; this file is the hand-kept
 * public surface for TypeScript consumers. It intentionally covers the stable
 * API only.
 */

export type Severity = 'off' | 'info' | 'warn' | 'error';

export interface Cue {
  start: number;
  end: number;
  lines: string[];
  index?: number;
  meta?: Record<string, unknown>;
}

export interface Diagnostic {
  ruleId: string;
  cue: Cue;
  line?: number;
  message: string;
  severity: Severity;
  fixable: boolean;
  data?: { suggestion?: string; [key: string]: unknown };
}

export interface LintResult {
  cueCount: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  problemCount: number;
  diagnostics: Diagnostic[];
}

export interface LintOptions {
  preset?: string;
  rules?: Record<string, Severity | [Severity, Record<string, unknown>]>;
  encoding?: string;
}

export interface FixResult {
  cues: Cue[];
  changed: number;
}

export interface LintAndFixResult extends FixResult {
  before: LintResult;
  after: LintResult;
}

export interface FormatOptions {
  format?: string;
  encoding?: string;
}

export interface Stats {
  cueCount: number;
  duration: number;
  dominant: 'cjk' | 'latin' | 'mixed' | 'none';
  chars: { cjk: number; latin: number; other: number; total: number };
  reading: { cjk: number; latin: number; total: number };
  cps: { cjk: number; latin: number; peak: number };
  lines: { max: number; sum: number };
  overlaps: number;
}

// ---- core/timecode ---------------------------------------------------------
export function parseTimecode(input: string | number): number;
export function parseDuration(input: string | number): number;
export function formatTimecode(ms: number, options?: { separator?: string; fractionDigits?: number; hourDigits?: number; clamp?: boolean }): string;
export function formatSrtTime(ms: number): string;
export function formatVttTime(ms: number): string;
export function formatAssTime(ms: number): string;
export function formatLrcTime(ms: number): string;
export function formatHuman(ms: number): string;
export function resolveFrameRate(input: string | number): number;
export const FRAME_RATES: Record<string, number>;

// ---- core/cue --------------------------------------------------------------
export function createCue(partial: Partial<Cue> & { start: number; end: number }): Cue;
export function normalizeLines(lines: string[]): string[];
export function cueText(cue: Cue, joiner?: string): string;
export function cueDuration(cue: Cue): number;
export function overlapMs(a: Cue, b: Cue): number;
export function overlapRatio(a: Cue, b: Cue): number;
export function cloneCue(cue: Cue): Cue;
export function cloneCues(cues: Cue[]): Cue[];
export function normalizeCues(cues: Cue[]): Cue[];
export function reindex(cues: Cue[]): Cue[];
export function trackSpan(cues: Cue[]): { start: number; end: number };

// ---- core/text -------------------------------------------------------------
export function displayWidth(text: string): number;
export function stripTags(text: string): string;
export function hasMarkup(text: string): boolean;
export function mapOutsideMarkup(text: string, fn: (chunk: string) => string): string;
export function analyzeScript(text: string): { cjk: number; latin: number; other: number; total: number; dominant: string };
export function readingTime(text: string, opts?: { cjkCps?: number; latinCps?: number }): number;
export function readingPressure(text: string, ms: number, opts?: { cjkCps?: number; latinCps?: number }): number;
export function charsPerSecond(text: string, ms: number): number;
export function addCjkLatinSpacing(text: string): string;
export function normalizeCjkPunctuation(text: string): string;
export function normalizeFullwidthLatin(text: string): string;
export function normalizeEllipsis(text: string): string;
export function hasFullwidthLatin(text: string): boolean;
export function tidyWhitespace(text: string): string;
export function stripTrailingPeriod(text: string): string;
export function endsWithPeriod(text: string): boolean;
export function isCjkChar(ch: string): boolean;
export const NO_LINE_START: string[];
export const NO_LINE_END: string[];
export const SENTENCE_END: string[];

// ---- core/wrap -------------------------------------------------------------
export function tokenize(text: string): string[];
export function greedyWrap(tokens: string[], width: number, maxLines?: number): string[];
export function wrapText(text: string, width: number, maxLines?: number): string[];
export function rewrapLines(lines: string[], opts?: { width?: number; maxLines?: number; balance?: boolean }): string[];
export function joinLines(lines: string[]): string;

// ---- core/formats ----------------------------------------------------------
export function parse(input: string, options?: { format?: string; encoding?: string }): Cue[];
export function serialize(cues: Cue[], format?: string): string;
export function detectFormat(input: string): string | null;
export function formatFromFilename(name: string): string | null;
export function serializeText(cues: Cue[], joiner?: string): string;
export function serializeMarkdown(cues: Cue[]): string;
export const formats: string[];
export const readableFormats: string[];
export const writableFormats: string[];

// ---- core/rules ------------------------------------------------------------
export const allRules: unknown[];
export const ruleMap: Map<string, unknown>;
export const presets: Record<string, { description: string; rules: Record<string, unknown> }>;
export const defaultPreset: string;
export const fixOrder: string[];

// ---- core/lint -------------------------------------------------------------
export function resolveConfig(opts?: LintOptions): unknown;
export function lint(cues: Cue[], opts?: LintOptions): LintResult;
export function fix(cues: Cue[], opts?: LintOptions): FixResult;
export function fixAndLint(cues: Cue[], opts?: LintOptions): LintAndFixResult;
export function severityRank(severity: Severity): number;

// ---- core/transform --------------------------------------------------------
export function shift(cues: Cue[], deltaMs: number): Cue[];
export function scale(cues: Cue[], factor: number, anchorMs?: number): Cue[];
export function resync(cues: Cue[], aIn: number, aOut: number, bIn: number, bOut: number): Cue[];
export function convertFrameRate(cues: Cue[], from: number, to: number): Cue[];
export function fixOverlaps(cues: Cue[], minGap?: number): Cue[];
export function removeEmpty(cues: Cue[]): Cue[];
export function dedupe(cues: Cue[], maxGap?: number): Cue[];
export function filterByText(cues: Cue[], pattern: string | RegExp): Cue[];
export function slice(cues: Cue[], fromMs: number, toMs: number): Cue[];
export function concat(...tracks: Cue[][]): Cue[];
export function rewrap(cues: Cue[], opts?: { width?: number; maxLines?: number; balance?: boolean }): Cue[];
export function clampDurations(cues: Cue[], min?: number, max?: number): Cue[];

// ---- core/bilingual --------------------------------------------------------
export function mergeBilingual(a: Cue[], b: Cue[], opts?: { mode?: 'stack' | 'interleave' | 'top' | 'bottom' }): Cue[];
export function splitBilingual(cues: Cue[], opts?: { strategy?: 'script' | 'line'; keep?: 'cjk' | 'latin' }): Cue[];
export function analyzeAlignment(a: Cue[], b: Cue[]): { matched: number; total: number; coverage: number };

// ---- core/stats & report ---------------------------------------------------
export function computeStats(cues: Cue[]): Stats;
export function formatText(reports: unknown[], opts?: { color?: boolean }): string;
export function formatCompact(reports: unknown[]): string;
export function formatJson(reports: unknown[]): string;
export function formatGitHub(reports: unknown[]): string;
export function formatStats(stats: Stats, opts?: { color?: boolean }): string;

// ---- core/colors -----------------------------------------------------------
export function createColors(enabled?: boolean): { red(s: string): string; yellow(s: string): string; green(s: string): string; dim(s: string): string; bold(s: string): string; gray(s: string): string; cyan(s: string): string; magenta(s: string): string };
export function supportsColor(): boolean;
export function stripAnsi(text: string): string;

export default {
  parse, serialize, lint, fix, presets, createCue, computeStats,
};
