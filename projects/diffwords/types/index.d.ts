/**
 * Type definitions for diffwords.
 * Hand-kept public surface for TypeScript consumers.
 */

export type TokenType = 'space' | 'cjk' | 'word' | 'punct';
export type OpType = 'equal' | 'insert' | 'delete';

export class Token {
  value: string;
  type: TokenType;
  constructor(value: string, type: TokenType);
}

export interface DiffStats {
  unchanged: number;
  added: number;
  removed: number;
  total: number;
  changeRatio: number;
  similarity: number;
}

export interface Op {
  type: OpType;
  tokens: Token[];
}

export interface DiffResult {
  ops: Op[];
  stats: DiffStats;
}

export function tokenize(text: string): Token[];
export function untokenize(tokens: Token[]): string;
export function isCjk(ch: string): boolean;

export function diffArrays<T>(a: T[], b: T[], eq?: (x: T, y: T) => boolean): Op[];

export function diff(a: string, b: string, options?: { granularity?: 'word' | 'line' }): DiffResult;
export function computeStats(ops: Op[]): DiffStats;
export function reconstructLines(ops: Op[], side: 'a' | 'b'): string[];

export function formatInline(result: DiffResult, options?: { color?: boolean }): string;
export function formatUnified(result: DiffResult, options?: { context?: number; aLabel?: string; bLabel?: string }): string;
export function formatHtml(result: DiffResult, options?: { mode?: 'inline' | 'side'; title?: string }): string;
export function formatJson(result: DiffResult): string;
export function stripAnsi(text: string): string;

export default { diff, formatInline, formatUnified, formatHtml, formatJson };
