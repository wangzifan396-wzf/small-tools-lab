export const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const MAX_TIMESTAMP = 0xffff_ffff_ffff;
export const MAX_RANDOMNESS = (1n << 80n) - 1n;
const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/u;

let defaultCrypto = globalThis.crypto;
if (!defaultCrypto && typeof process !== 'undefined' && process.versions?.node) {
  defaultCrypto = (await import('node:crypto')).webcrypto;
}

function requireCrypto(source) {
  if (!source || typeof source.getRandomValues !== 'function') {
    throw new Error('A cryptographically secure getRandomValues implementation is required');
  }
  return source;
}

function validateTimestamp(timestamp) {
  const value = timestamp instanceof Date ? timestamp.getTime() : timestamp;
  if (!Number.isInteger(value) || value < 0 || value > MAX_TIMESTAMP) {
    throw new RangeError(`Timestamp must be an integer between 0 and ${MAX_TIMESTAMP}`);
  }
  return value;
}

export function randomBytes(length, cryptoSource = defaultCrypto) {
  if (!Number.isInteger(length) || length < 1 || length > 65_536) {
    throw new RangeError('Byte length must be an integer between 1 and 65536');
  }
  const bytes = new Uint8Array(length);
  requireCrypto(cryptoSource).getRandomValues(bytes);
  return bytes;
}

function bytesToBigInt(bytes) {
  let result = 0n;
  for (const byte of bytes) result = (result << 8n) | BigInt(byte);
  return result;
}

export function encodeBase32(value, length) {
  let remaining;
  try { remaining = BigInt(value); }
  catch { throw new TypeError('Base32 value must be an integer'); }
  if (remaining < 0n) throw new RangeError('Base32 value cannot be negative');
  if (!Number.isInteger(length) || length < 1) throw new RangeError('Base32 length must be a positive integer');
  const limit = 32n ** BigInt(length);
  if (remaining >= limit) throw new RangeError(`Base32 value does not fit in ${length} characters`);
  let output = '';
  do {
    output = ALPHABET[Number(remaining % 32n)] + output;
    remaining /= 32n;
  } while (remaining > 0n);
  return output.padStart(length, '0');
}

export function decodeBase32(source) {
  if (typeof source !== 'string' || source.length === 0) throw new TypeError('Base32 input must be a non-empty string');
  const normalized = source.toUpperCase();
  let result = 0n;
  for (const character of normalized) {
    const index = ALPHABET.indexOf(character);
    if (index < 0) throw new TypeError(`Invalid Crockford Base32 character: ${character}`);
    result = result * 32n + BigInt(index);
  }
  return result;
}

export function encodeTime(timestamp) {
  return encodeBase32(validateTimestamp(timestamp), 10);
}

export function encodeRandom(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length !== 10) throw new TypeError('ULID randomness must be exactly 10 bytes');
  return encodeBase32(bytesToBigInt(bytes), 16);
}

function encodeParts(timestamp, randomness) {
  if (typeof randomness !== 'bigint' || randomness < 0n || randomness > MAX_RANDOMNESS) {
    throw new RangeError('ULID randomness must be an unsigned 80-bit integer');
  }
  return `${encodeTime(timestamp)}${encodeBase32(randomness, 16)}`;
}

export function generateUlid(timestamp = Date.now(), options = {}) {
  if (!options || typeof options !== 'object') throw new TypeError('Options must be an object');
  const time = validateTimestamp(timestamp);
  const cryptoSource = options.cryptoSource === undefined ? defaultCrypto : options.cryptoSource;
  return `${encodeTime(time)}${encodeRandom(randomBytes(10, cryptoSource))}`;
}

export function decodeUlid(value) {
  if (typeof value !== 'string') throw new TypeError('ULID must be a string');
  const canonical = value.toUpperCase();
  if (!ULID_PATTERN.test(canonical)) throw new TypeError('ULID must contain exactly 26 Crockford Base32 characters');
  const timestampValue = decodeBase32(canonical.slice(0, 10));
  if (timestampValue > BigInt(MAX_TIMESTAMP)) throw new RangeError('ULID timestamp exceeds the 48-bit specification limit');
  const randomness = decodeBase32(canonical.slice(10));
  const timestamp = Number(timestampValue);
  return {
    ulid: canonical,
    timestamp,
    time: new Date(timestamp),
    randomness,
    randomnessHex: randomness.toString(16).padStart(20, '0'),
  };
}

export function isValidUlid(value) {
  try { decodeUlid(value); return true; }
  catch { return false; }
}

export function createMonotonicFactory(options = {}) {
  if (!options || typeof options !== 'object') throw new TypeError('Options must be an object');
  const cryptoSource = options.cryptoSource === undefined ? defaultCrypto : options.cryptoSource;
  requireCrypto(cryptoSource);
  let lastTimestamp = -1;
  let lastRandomness = -1n;
  return (timestamp = Date.now()) => {
    const requested = validateTimestamp(timestamp);
    if (requested > lastTimestamp) {
      lastTimestamp = requested;
      lastRandomness = bytesToBigInt(randomBytes(10, cryptoSource));
    } else {
      if (lastRandomness >= MAX_RANDOMNESS) throw new RangeError('ULID monotonic randomness overflowed within one timestamp');
      lastRandomness += 1n;
    }
    return encodeParts(lastTimestamp, lastRandomness);
  };
}
