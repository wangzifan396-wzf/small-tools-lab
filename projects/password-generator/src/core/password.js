const DEFAULT_SETS = Object.freeze({
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digits: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.<>?',
});
const AMBIGUOUS = new Set('0O1lI|`\'"');
const UINT32_RANGE = 0x1_0000_0000;

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

function validateBooleanOptions(options) {
  for (const key of ['lowercase', 'uppercase', 'digits', 'symbols', 'excludeAmbiguous']) {
    if (options[key] !== undefined && typeof options[key] !== 'boolean') throw new TypeError(`${key} must be a boolean`);
  }
}

export function randomInt(maxExclusive, cryptoSource = defaultCrypto) {
  if (!Number.isInteger(maxExclusive) || maxExclusive < 1 || maxExclusive > UINT32_RANGE) {
    throw new RangeError('maxExclusive must be an integer between 1 and 4294967296');
  }
  const crypto = requireCrypto(cryptoSource);
  const limit = Math.floor(UINT32_RANGE / maxExclusive) * maxExclusive;
  const buffer = new Uint32Array(1);
  do { crypto.getRandomValues(buffer); } while (buffer[0] >= limit);
  return buffer[0] % maxExclusive;
}

export function buildCharacterSets(options = {}) {
  if (!options || typeof options !== 'object') throw new TypeError('Options must be an object');
  validateBooleanOptions(options);
  const enabled = {
    lowercase: options.lowercase ?? true,
    uppercase: options.uppercase ?? true,
    digits: options.digits ?? true,
    symbols: options.symbols ?? true,
  };
  const exclude = options.excludeAmbiguous ?? false;
  const sets = Object.entries(DEFAULT_SETS)
    .filter(([name]) => enabled[name])
    .map(([name, characters]) => ({
      name,
      characters: exclude ? [...characters].filter((character) => !AMBIGUOUS.has(character)).join('') : characters,
    }))
    .filter((set) => set.characters.length > 0);
  if (sets.length === 0) throw new RangeError('At least one character set must be enabled');
  return sets;
}

function validateLength(length, setCount = 1) {
  if (!Number.isInteger(length) || length < 4 || length > 1024) throw new RangeError('Length must be an integer between 4 and 1024');
  if (length < setCount) throw new RangeError(`Length must be at least ${setCount} to include every selected character set`);
}

function secureShuffle(characters, cryptoSource) {
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const selected = randomInt(index + 1, cryptoSource);
    [characters[index], characters[selected]] = [characters[selected], characters[index]];
  }
  return characters;
}

export function generatePassword(length = 16, options = {}) {
  const sets = buildCharacterSets(options);
  validateLength(length, sets.length);
  const cryptoSource = options.cryptoSource === undefined ? defaultCrypto : options.cryptoSource;
  requireCrypto(cryptoSource);
  const pool = sets.map((set) => set.characters).join('');
  const result = sets.map((set) => set.characters[randomInt(set.characters.length, cryptoSource)]);
  while (result.length < length) result.push(pool[randomInt(pool.length, cryptoSource)]);
  return secureShuffle(result, cryptoSource).join('');
}

export function generatePasswords(count = 1, options = {}) {
  if (!Number.isInteger(count) || count < 1 || count > 100) throw new RangeError('Count must be an integer between 1 and 100');
  const length = options.length ?? 16;
  return Array.from({ length: count }, () => generatePassword(length, options));
}

export function estimateEntropy(length = 16, options = {}) {
  const sets = buildCharacterSets(options);
  validateLength(length, sets.length);
  const poolSize = new Set(sets.flatMap((set) => [...set.characters])).size;
  return length * Math.log2(poolSize);
}

export function classifyEntropy(bits) {
  if (typeof bits !== 'number' || !Number.isFinite(bits) || bits < 0) throw new RangeError('Entropy must be a non-negative finite number');
  if (bits < 40) return 'weak';
  if (bits < 64) return 'fair';
  if (bits < 100) return 'strong';
  return 'very-strong';
}
