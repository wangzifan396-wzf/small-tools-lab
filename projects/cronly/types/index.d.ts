/**
 * Type definitions for cronly — a zero-dependency cron toolkit.
 *
 * Covers parsing, human-readable description, and timezone-aware schedule
 * computation for standard 5-field and 6-field (with seconds) cron expressions.
 */

/** A parsed cron expression. */
export interface Cron {
  /** Whether the source expression used a leading seconds field. */
  hasSeconds: boolean;
  /** Allowed seconds (0-59). Always present; defaults to {0} when no seconds field. */
  seconds: Set<number>;
  /** Allowed minutes (0-59). */
  minute: Set<number>;
  /** Allowed hours (0-23). */
  hour: Set<number>;
  /** Allowed days of month (1-31). */
  dom: Set<number>;
  /** Allowed months (1-12). */
  month: Set<number>;
  /** Allowed days of week (0-6, where 0 = Sunday). */
  dow: Set<number>;
  /** True when the day-of-month field is an unconstrained `*`. */
  domStar: boolean;
  /** True when the day-of-week field is an unconstrained `*`. */
  dowStar: boolean;
}

/** Error thrown for invalid cron expressions. */
export class CronError extends Error {
  constructor(message: string);
  name: 'CronError';
}

export interface ParseOptions {
  /** Enable 6-field parsing with a leading seconds field. */
  seconds?: boolean;
}

/**
 * Parse and validate a cron expression.
 * @throws {CronError} if the expression is malformed.
 */
export function parse(expr: string, options?: ParseOptions): Cron;

export interface DescribeOptions {
  /** Output language: `'en'` (default) or `'zh'`. */
  lang?: 'en' | 'zh';
  /** Must match the expression's field count; inferred from `expr` if omitted. */
  seconds?: boolean;
}

/** Human-readable description of a cron expression, in English or Chinese. */
export function describe(expr: string, options?: DescribeOptions): string;

export interface ScheduleOptions {
  /** IANA timezone, e.g. `'Asia/Shanghai'`. Omit for the runtime's local zone. */
  timeZone?: string;
  /** Must match the expression's field count; inferred from `expr` if omitted. */
  seconds?: boolean;
}

/** Next run time strictly after `from` (null if none within ~5 years). */
export function next(expr: string, from?: Date, options?: ScheduleOptions): Date | null;

/** Previous run time strictly before `from` (null if none within ~5 years). */
export function prev(expr: string, from?: Date, options?: ScheduleOptions): Date | null;

/** The next `count` run times after `from`. */
export function nextRuns(
  expr: string,
  count?: number,
  from?: Date,
  options?: ScheduleOptions
): Date[];

/** Wall-clock parts of `date` in a given IANA timezone. */
export interface TzParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** Day of week: 0 (Sunday) - 6 (Saturday). */
  dow: number;
}

export function partsInTz(date: Date, tz?: string): TzParts;

/** Whether a parsed cron matches a given wall-clock date. */
export function dayMatches(cron: Cron, p: TzParts): boolean;
