export function get(obj: unknown, path: string): unknown;
export function pick<T extends object>(obj: T, keys: string[]): Partial<T>;
export function omit<T extends object>(obj: T, keys: string[]): Partial<T>;
export function filter(arr: unknown[], key: string, op: string, value: unknown): unknown[];
export function sortBy(arr: unknown[], key: string, dir?: 'asc' | 'desc'): unknown[];
export function select(arr: object[], keys: string[]): object[];
