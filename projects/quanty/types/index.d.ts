/**
 * Type definitions for quanty — a zero-dependency number & byte formatting toolkit.
 */

export interface FormatBytesOptions {
  /** Use 1024-based units (KiB) when true; 1000-based (kB) when false. Default true. */
  binary?: boolean;
  /** Fractional digits. Default 1. */
  decimals?: number;
  /** BCP-47 locale; decimal/grouping follow the locale when set. */
  locale?: string;
  /** Drop a trailing `.0`. Default true. */
  trimZero?: boolean;
}

/** Format a byte count into a human-readable string. */
export function formatBytes(bytes: number, options?: FormatBytesOptions): string;

/** Parse a human-readable byte string (or number) back into bytes. */
export function parseBytes(input: string | number): number;

export interface FormatNumberOptions {
  /** Fractional digits. Default 0. */
  decimals?: number;
  /** Add thousands separators. Default true. */
  thousands?: boolean;
  /** BCP-47 locale; delegates to Intl.NumberFormat when set. */
  locale?: string;
}

/** Group and round a number. */
export function formatNumber(n: number, options?: FormatNumberOptions): string;

export interface FormatCompactOptions {
  /** Threshold table: `'si'` (K/M/B/T) or `'zh'` (万/亿/万亿). Default `'si'`. */
  style?: 'si' | 'zh';
  /** Fractional digits. Default 1. */
  decimals?: number;
}

/** Compact notation, e.g. `1.5M` (si) or `150万` (zh). */
export function formatCompact(n: number, options?: FormatCompactOptions): string;

export interface OrdinalOptions {
  /** `'en'` (default) or `'zh'`. */
  lang?: 'en' | 'zh';
}

/** Ordinal suffix: `1st` (en) or `第1` (zh). */
export function ordinal(n: number, options?: OrdinalOptions): string;
