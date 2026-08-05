/**
 * hashforge command-line interface.
 *
 * Subcommands: hash, hmac, encode, decode, file, check.
 *
 * @module cli
 */

import { hashText, hmacText, encode, decode, verify, hashFile } from './index.js';

const VERSION = '0.1.0';

function usage() {
  return [
    'hashforge — zero-dependency hashing, HMAC & codec',
    '',
    'Usage:',
    '  hashforge hash <text>            SHA digest of text      [--algo sha256]',
    '  hashforge hmac <text>            HMAC of text             --secret X [--algo sha256]',
    '  hashforge encode <text>          base64 / hex encode      [--enc base64|hex]',
    '  hashforge decode <str>           base64 / hex decode      [--enc base64|hex]',
    '  hashforge file <path>            SHA digest of a file     [--algo sha256]',
    '  hashforge check <path> <hex>     verify file checksum     [--algo sha256]',
    '  hashforge --help | --version',
    '',
    'Supported algorithms: sha1, sha256, sha384, sha512 (md5 omitted — insecure).',
    '',
    'Examples:',
    '  hashforge hash "hello"                       → 2cf24dba...',
    '  hashforge hmac "msg" --secret key            → hmac-sha256 hex',
    '  hashforge encode "hi" --enc base64           → aGk=',
    '  hashforge file ./build.zip --algo sha256     → <hex>',
    '  hashforge check ./build.zip <expected-hex>   → OK / MISMATCH',
  ].join('\n');
}

function parseArgs(argv) {
  const args = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--help' || a === '-h') args.flags.help = true;
    else if (a === '--version' || a === '-v') args.flags.version = true;
    else if (a === '--algo') args.flags.algo = argv[++i];
    else if (a === '--enc') args.flags.enc = argv[++i];
    else if (a === '--secret') args.flags.secret = argv[++i];
    else args._.push(a);
  }
  return args;
}

export async function run(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.flags.help) { console.log(usage()); return 0; }
  if (args.flags.version) { console.log(VERSION); return 0; }

  const [cmd, value] = args._;
  if (!cmd) { console.error(usage()); return 2; }

  try {
    switch (cmd) {
      case 'hash': {
        console.log(await hashText(value, args.flags.algo || 'sha256'));
        return 0;
      }
      case 'hmac': {
        if (!args.flags.secret) throw new Error('--secret is required for hmac');
        console.log(await hmacText(value, args.flags.secret, args.flags.algo || 'sha256'));
        return 0;
      }
      case 'encode': {
        console.log(encode(value, args.flags.enc || 'base64'));
        return 0;
      }
      case 'decode': {
        console.log(decode(value, args.flags.enc || 'base64'));
        return 0;
      }
      case 'file': {
        console.log(await hashFile(value, args.flags.algo || 'sha256'));
        return 0;
      }
      case 'check': {
        const actual = await hashFile(value, args.flags.algo || 'sha256');
        const ok = verify(args._[2], actual);
        console.log(ok ? 'OK' : 'MISMATCH');
        return ok ? 0 : 1;
      }
      default:
        console.error(`unknown command: ${cmd}\n`);
        console.error(usage());
        return 2;
    }
  } catch (err) {
    console.error(`hashforge: ${err.message}`);
    return 1;
  }
}
