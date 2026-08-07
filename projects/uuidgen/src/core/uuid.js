const DASHED_UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const COMPACT_UUID_V4 = /^[0-9a-f]{12}4[0-9a-f]{3}[89ab][0-9a-f]{15}$/iu;
let defaultCrypto = globalThis.crypto;
if (!defaultCrypto && typeof process !== 'undefined' && process.versions?.node) {
  defaultCrypto = (await import('node:crypto')).webcrypto;
}

function requireCryptoSource(cryptoSource) {
  if (!cryptoSource || typeof cryptoSource.getRandomValues !== 'function') {
    throw new Error('A cryptographically secure getRandomValues implementation is required');
  }
  return cryptoSource;
}

export function uuidV4(options = {}) {
  const cryptoSource = requireCryptoSource(
    options.cryptoSource === undefined ? defaultCrypto : options.cryptoSource,
  );
  const bytes = new Uint8Array(16);
  cryptoSource.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function generateUuids(count = 1, options = {}) {
  if (!Number.isInteger(count) || count < 1 || count > 200) {
    throw new RangeError('Count must be an integer between 1 and 200');
  }
  const { dashes = true, uppercase = false, cryptoSource } = options;
  if (typeof dashes !== 'boolean' || typeof uppercase !== 'boolean') {
    throw new TypeError('dashes and uppercase must be booleans');
  }
  return Array.from({ length: count }, () => {
    let value = uuidV4({ cryptoSource });
    if (!dashes) value = value.replaceAll('-', '');
    if (uppercase) value = value.toUpperCase();
    return value;
  });
}

export function isUuidV4(value) {
  return typeof value === 'string' && (DASHED_UUID_V4.test(value) || COMPACT_UUID_V4.test(value));
}
