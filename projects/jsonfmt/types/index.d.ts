export interface FormatOptions { indent?: number | '\t'; sortKeys?: boolean; finalNewline?: boolean }
export interface ValidationResult { valid: boolean; value: unknown; error: string | null; line: number | null; column: number | null; offset: number | null }
export function parseJson(text: string): unknown;
export function sortJsonKeys<T>(value: T): T;
export function formatJson(text: string, options?: FormatOptions): string;
export function minifyJson(text: string): string;
export function validateJson(text: string): ValidationResult;
