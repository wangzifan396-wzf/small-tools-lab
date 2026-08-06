export const MAX_BASE: number;
export function alphabetFor(base: number): string | null;
export function isValidInput(str: string, base: number): boolean;
export function toDecimal(str: string, fromBase: number): bigint;
export function fromDecimal(value: bigint | number, toBase: number): string;
export interface ConvertResult {
  input: string;
  fromBase: number;
  toBase: number;
  decimal: string;
  value: string;
  negative: boolean;
  unsignedValue: string;
}
export function convert(str: string, fromBase: number, toBase: number): ConvertResult;
export interface CommonConversions {
  binary: string;
  octal: string;
  decimal: string;
  hex: string;
}
export function commonConversions(str: string, fromBase: number): CommonConversions;
export interface BitView {
  binary: string;
  bits: number;
  byteLength: number;
  bytes: string[];
}
export function bitView(str: string, fromBase: number): BitView;
