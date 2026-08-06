export function slugify(input: string, opts?: { lower?: boolean; sep?: string }): string;
export function toCase(input: string, mode:
  'camel' | 'pascal' | 'snake' | 'kebab' | 'constant' | 'title' | 'lower' | 'upper' | 'sentence'
): string;
export function normalizeUnicode(input: string, form: 'NFC' | 'NFD' | 'NFKC' | 'NFKD'): string;
export function removeDiacritics(input: string): string;
export function width(input: string, to: 'full' | 'half'): string;
export function toFullWidth(input: string): string;
export function toHalfWidth(input: string): string;
export function cleanWhitespace(input: string, opts?: { collapse?: boolean; trim?: boolean }): string;
