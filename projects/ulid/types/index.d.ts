export const ALPHABET: string;
export const MAX_TIMESTAMP: number;
export const MAX_RANDOMNESS: bigint;
export interface CryptoSource { getRandomValues<T extends ArrayBufferView>(array: T): T }
export interface GenerateOptions { cryptoSource?: CryptoSource | null }
export interface DecodedUlid { ulid: string; timestamp: number; time: Date; randomness: bigint; randomnessHex: string }
export function randomBytes(length: number, cryptoSource?: CryptoSource): Uint8Array;
export function encodeBase32(value: number | bigint, length: number): string;
export function decodeBase32(source: string): bigint;
export function encodeTime(timestamp: number | Date): string;
export function encodeRandom(bytes: Uint8Array): string;
export function generateUlid(timestamp?: number | Date, options?: GenerateOptions): string;
export function decodeUlid(value: string): DecodedUlid;
export function isValidUlid(value: unknown): value is string;
export function createMonotonicFactory(options?: GenerateOptions): (timestamp?: number | Date) => string;
export { generateUlid as generate, decodeUlid as decode, isValidUlid as isValid };
