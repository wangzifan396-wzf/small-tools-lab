/**
 * hashforge — zero-dependency hashing, HMAC and codec toolkit.
 *
 * Runs in Node 18+ and the browser via the Web Crypto API. No build step.
 *
 * @module hashforge
 */

export {
  digest, hashText, hashBytes, hashFile, hmac, hmacText, encode, decode, verify, hexToBytes
} from './core/hash.js';
