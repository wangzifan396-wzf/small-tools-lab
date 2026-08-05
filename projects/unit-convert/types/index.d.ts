export const CATEGORIES: Record<string, { base: string; special?: boolean; units: Record<string, number> }>;
export function listCategories(): string[];
export function unitsInCategory(category: string): string[];
export function categoryOf(unit: string): string | null;
export function findUnit(unit: string): { category: string; symbol: string } | null;
export function convert(value: number | string, from: string, to: string): number;
export function formatNumber(n: number): string;
export function convertWithUnit(value: number | string, from: string, to: string): { value: number; unit: string; formatted: string };
