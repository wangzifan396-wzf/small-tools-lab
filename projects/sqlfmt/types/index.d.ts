export type SqlTokenType = 'whitespace' | 'line-comment' | 'block-comment' | 'string' | 'quoted-identifier' | 'placeholder' | 'keyword' | 'word' | 'number' | 'operator' | 'punctuation';
export interface SqlToken { type: SqlTokenType; raw: string; value: string; line: number; column: number }
export interface FormatOptions { keywordCase?: 'upper' | 'lower' | 'preserve'; indent?: number | string }
export interface MinifyOptions { removeComments?: boolean }
export function tokenizeSql(input: string): SqlToken[];
export function formatSql(input: string, options?: FormatOptions): string;
export function minifySql(input: string, options?: MinifyOptions): string;
export { formatSql as format, minifySql as minify };
