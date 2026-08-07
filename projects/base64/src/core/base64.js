const STANDARD = /^[A-Za-z0-9+/]*={0,2}$/u;

export function utf8ToBytes(value) {
  if (typeof value !== 'string') throw new TypeError('Input must be a string');
  return new TextEncoder().encode(value);
}

export function bytesToUtf8(bytes) {
  if (!(bytes instanceof Uint8Array)) throw new TypeError('Input must be a Uint8Array');
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { throw new SyntaxError('Decoded bytes are not valid UTF-8'); }
}

export function bytesToBase64(bytes) {
  if (!(bytes instanceof Uint8Array)) throw new TypeError('Input must be a Uint8Array');
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

export function normalizeBase64(value, options = {}) {
  if (typeof value !== 'string') throw new TypeError('Base64 input must be a string');
  const { urlSafe = 'auto', allowWhitespace = true } = options;
  if (![true, false, 'auto'].includes(urlSafe)) throw new TypeError('urlSafe must be true, false, or auto');
  let input = allowWhitespace ? value.replace(/\s/gu, '') : value;
  const hasUrlAlphabet = /[-_]/u.test(input);
  if (urlSafe === false && hasUrlAlphabet) throw new SyntaxError('URL-safe Base64 alphabet is not allowed');
  if (urlSafe === true || urlSafe === 'auto') input = input.replaceAll('-', '+').replaceAll('_', '/');
  if (!STANDARD.test(input) || input.length % 4 === 1 || /=/.test(input.slice(0, -2))) {
    throw new SyntaxError('Invalid Base64 input');
  }
  const unpadded = input.replace(/=+$/u, '');
  return unpadded + '='.repeat((4 - (unpadded.length % 4)) % 4);
}

export function base64ToBytes(value, options = {}) {
  const normalized = normalizeBase64(value, options);
  let binary;
  try { binary = atob(normalized); } catch { throw new SyntaxError('Invalid Base64 input'); }
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function encodeBase64(value, options = {}) {
  const { urlSafe = false, padding = true } = options;
  if (typeof urlSafe !== 'boolean' || typeof padding !== 'boolean') throw new TypeError('urlSafe and padding must be booleans');
  let output = bytesToBase64(utf8ToBytes(value));
  if (urlSafe) output = output.replaceAll('+', '-').replaceAll('/', '_');
  return padding ? output : output.replace(/=+$/u, '');
}

export function decodeBase64(value, options = {}) {
  return bytesToUtf8(base64ToBytes(value, options));
}
