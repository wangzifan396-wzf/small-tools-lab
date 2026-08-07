export interface CryptoSource {
  getRandomValues<T extends ArrayBufferView | null>(array: T): T;
}

export interface UuidOptions {
  cryptoSource?: CryptoSource;
}

export interface GenerateUuidOptions extends UuidOptions {
  dashes?: boolean;
  uppercase?: boolean;
}

export function uuidV4(options?: UuidOptions): string;
export function generateUuids(count?: number, options?: GenerateUuidOptions): string[];
export function isUuidV4(value: unknown): boolean;
