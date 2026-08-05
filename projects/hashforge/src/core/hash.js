/**
 * hashforge core — cryptographic hashes, HMAC and codec helpers.
 *
 * Built on the Web Crypto API (`crypto.subtle`) so the exact same code runs in
 * Node 18+ and in the browser with zero dependencies. MD5 is intentionally
 * absent (insecure + unavailable in Web Crypto); we expose SHA-1/256/384/512.
 *
 * @module hashforge/core/hash
 */

const ALGOS = { sha1: 'SHA-1', sha256: 'SHA-256', sha384: 'SHA-384', sha512: 'SHA-512' };

function bufToHex(buf) {
  const b = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < b.length; i += 1) s += b[i].toString(16).padStart(2, '0');
  return s;
}

export function hexToBytes(hex) {
  const h = String(hex).replace(/[^0-9a-fA-F]/g, '');
  if (h.length % 2) throw new Error('invalid hex string');
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(h.substr(i * 2, 2), 16);
  return out;
}

function utf8Bytes(str) {
  return new TextEncoder().encode(str);
}

function toBase64(bytes) {
  if (typeof btoa === 'function') {
    let bin = '';
    for (const x of bytes) bin += String.fromCharCode(x);
    return btoa(bin);
  }
  return Buffer.from(bytes).toString('base64');
}

function fromBase64(str) {
  if (typeof atob === 'function') {
    const bin = atob(str);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < out.length; i += 1) out[i] = bin.charCodeAt(i);
    return out;
  }
  return new Uint8Array(Buffer.from(str, 'base64'));
}

function algoName(algo) {
  const name = ALGOS[String(algo).toLowerCase()];
  if (!name) {
    throw new Error('unsupported algorithm: ' + algo + ' (supported: sha1, sha256, sha384, sha512)');
  }
  return name;
}

function toBytes(input) {
  if (typeof input === 'string') return utf8Bytes(input);
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  throw new Error('input must be a string or Uint8Array');
}

/** Hash arbitrary bytes and return a lowercase hex digest. */
export async function digest(algo, input) {
  const name = algoName(algo);
  const data = toBytes(input);
  const buf = await crypto.subtle.digest(name, data);
  return bufToHex(buf);
}

/** Hash a UTF-8 string. */
export async function hashText(text, algo = 'sha256') {
  return digest(algo, text);
}

/** Hash a byte array (Node + browser). */
export async function hashBytes(bytes, algo = 'sha256') {
  return digest(algo, bytes);
}

/** Hash a file on disk (Node only — uses node:fs). */
export async function hashFile(path, algo = 'sha256') {
  const { readFile } = await import('node:fs/promises');
  const data = await readFile(path);
  const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  return digest(algo, bytes);
}

/** HMAC of arbitrary bytes. */
export async function hmac(algo, secret, message) {
  const name = algoName(algo);
  const keyBytes = toBytes(secret);
  const msgBytes = toBytes(message);
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: name }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, msgBytes);
  return bufToHex(sig);
}

/** HMAC of a UTF-8 string. */
export async function hmacText(text, secret, algo = 'sha256') {
  return hmac(algo, secret, text);
}

/** Encode UTF-8 text to base64 or hex. */
export function encode(text, enc = 'base64') {
  const bytes = utf8Bytes(text);
  if (enc === 'hex') return bufToHex(bytes);
  if (enc === 'base64') return toBase64(bytes);
  throw new Error('unsupported encoding: ' + enc + ' (supported: base64, hex)');
}

/** Decode base64 or hex back to a UTF-8 string. */
export function decode(str, enc = 'base64') {
  let bytes;
  if (enc === 'hex') bytes = hexToBytes(str);
  else if (enc === 'base64') bytes = fromBase64(str);
  else throw new Error('unsupported encoding: ' + enc + ' (supported: base64, hex)');
  return new TextDecoder().decode(bytes);
}

/** Case/whitespace-insensitive comparison of two hex/base64 digests. */
export function verify(expected, actual) {
  const norm = (s) => String(s).replace(/\s+/g, '').toLowerCase();
  return norm(expected) === norm(actual);
}
