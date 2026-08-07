export interface RgbColor { r: number; g: number; b: number; a: number }
export interface HslColor { h: number; s: number; l: number; a?: number }
export function parseHex(value: string): RgbColor;
export function parseRgb(value: string): RgbColor;
export function normalizeHue(value: number): number;
export function hslToRgb(value: HslColor): RgbColor;
export function parseHsl(value: string): RgbColor;
export function parseColor(value: string): RgbColor;
export function rgbToHex(color: RgbColor, options?: { includeAlpha?: boolean; uppercase?: boolean }): string;
export function rgbToHsl(color: RgbColor): Required<HslColor>;
export function formatRgb(color: RgbColor): string;
export function formatHsl(color: RgbColor): string;
