export interface QueryPair { key: string; value: string; hasEquals: boolean }
export interface ParsedQuery { base: string; fragment: string | null; explicitQuestionMark: boolean; pairs: QueryPair[] }
export interface ParseOptions { plusAsSpace?: boolean }
export interface BuildOptions { spaceAsPlus?: boolean }
export interface ObjectOptions { duplicates?: 'combine' | 'first' | 'last' }
export type QueryObjectValue = string | null | Array<string | null>;
export function parseQuery(input: string, options?: ParseOptions): ParsedQuery;
export function buildQuery(pairs: QueryPair[], options?: BuildOptions): string;
export function rebuildUrl(parsed: ParsedQuery, pairs?: QueryPair[], options?: BuildOptions): string;
export function pairsToObject(pairs: QueryPair[], options?: ObjectOptions): Record<string, QueryObjectValue>;
