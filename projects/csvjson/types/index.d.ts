export interface CsvOptions {
  delimiter?: string | 'auto';
  header?: boolean;
  skipBlankRows?: boolean;
}

export interface CsvData<T = Record<string, string> | string[]> {
  delimiter: string;
  rows: string[][];
  data: T[];
}

export const DEFAULT_DELIMITERS: readonly string[];
export function detectDelimiter(text: string, candidates?: string[]): string;
export function parseCsv(text: string, delimiter?: string): string[][];
export function csvEscape(value: unknown, delimiter?: string): string;
export function csvToData(text: string, options?: CsvOptions): CsvData;
export function csvToJson(text: string, options?: CsvOptions, space?: number | string): string;
export function jsonToCsv(input: string | unknown, delimiter?: string): string;
