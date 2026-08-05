export type Algo = 'sha1' | 'sha256' | 'sha384' | 'sha512';
export type Encoding = 'base64' | 'hex';

export function digest(algo: Algo, input: string | Uint8Array | ArrayBuffer): Promise<string>;
export function hashText(text: string, algo?: Algo): Promise<string>;
export function hashBytes(bytes: Uint8Array | ArrayBuffer, algo?: Algo): Promise<string>;
export function hashFile(path: string, algo?: Algo): Promise<string>;
export function hmac(algo: Algo, secret: string | Uint8Array, message: string | Uint8Array): Promise<string>;
export function hmacText(text: string, secret: string, algo?: Algo): Promise<string>;
export function encode(text: string, enc?: Encoding): string;
export function decode(str: string, enc?: Encoding): string;
export function verify(expected: string, actual: string): boolean;
export function hexToBytes(hex: string): Uint8Array;
