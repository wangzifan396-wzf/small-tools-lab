export interface EncodeOptions { urlSafe?: boolean; padding?: boolean }
export interface DecodeOptions { urlSafe?: boolean | 'auto'; allowWhitespace?: boolean }
export function utf8ToBytes(value: string): Uint8Array;
export function bytesToUtf8(bytes: Uint8Array): string;
export function bytesToBase64(bytes: Uint8Array): string;
export function normalizeBase64(value: string, options?: DecodeOptions): string;
export function base64ToBytes(value: string, options?: DecodeOptions): Uint8Array;
export function encodeBase64(value: string, options?: EncodeOptions): string;
export function decodeBase64(value: string, options?: DecodeOptions): string;
