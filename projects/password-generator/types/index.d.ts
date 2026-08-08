export interface CryptoSource { getRandomValues<T extends ArrayBufferView>(array: T): T }
export interface CharacterSetOptions {
  lowercase?: boolean;
  uppercase?: boolean;
  digits?: boolean;
  symbols?: boolean;
  excludeAmbiguous?: boolean;
  cryptoSource?: CryptoSource | null;
}
export interface GenerateOptions extends CharacterSetOptions { length?: number }
export interface CharacterSet { name: 'lowercase' | 'uppercase' | 'digits' | 'symbols'; characters: string }
export type EntropyClass = 'weak' | 'fair' | 'strong' | 'very-strong';
export function randomInt(maxExclusive: number, cryptoSource?: CryptoSource): number;
export function buildCharacterSets(options?: CharacterSetOptions): CharacterSet[];
export function generatePassword(length?: number, options?: CharacterSetOptions): string;
export function generatePasswords(count?: number, options?: GenerateOptions): string[];
export function estimateEntropy(length?: number, options?: CharacterSetOptions): number;
export function classifyEntropy(bits: number): EntropyClass;
