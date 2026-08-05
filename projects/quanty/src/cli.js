/**
 * quanty command-line interface.
 *
 * Subcommands: bytes, parse, number, compact, ordinal.
 *
 * @module cli
 */

import { formatBytes, parseBytes, formatNumber, formatCompact, ordinal } from './index.js';

const VERSION = '0.1.0';

function usage() {
  return [
    'quanty — zero-dependency number & byte formatter',
    '',
    'Usage:',
    '  quanty bytes <n>            format a byte count        [--si] [--decimals N] [--locale xx]',
    '  quanty parse <str>          parse a byte string         e.g. "1.5 KiB"',
    '  quanty number <n>           group + decimals           [--decimals N] [--no-thousands] [--locale xx]',
    '  quanty compact <n>          compact notation           [--style si|zh] [--decimals N]',
    '  quanty ordinal <n>          ordinal suffix             [--lang en|zh]',
    '  quanty --help | --version',
    '',
    'Examples:',
    '  quanty bytes 1536            →  1.5 KiB',
    '  quanty bytes 1500000 --si    →  1.5 MB',
    '  quanty compact 1500000 --style zh   →  150万',
    '  quanty ordinal 22 --lang zh  →  第22',
  ].join('\n');
}

function parseArgs(argv) {
  const args = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--help' || a === '-h') args.flags.help = true;
    else if (a === '--version' || a === '-v') args.flags.version = true;
    else if (a === '--si') args.flags.si = true;
    else if (a === '--no-thousands') args.flags.thousands = false;
    else if (a === '--decimals') args.flags.decimals = Number(argv[++i]);
    else if (a === '--locale') args.flags.locale = argv[++i];
    else if (a === '--style') args.flags.style = argv[++i];
    else if (a === '--lang') args.flags.lang = argv[++i];
    else args._.push(a);
  }
  return args;
}

export function run(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.flags.help) {
    console.log(usage());
    return 0;
  }
  if (args.flags.version) {
    console.log(VERSION);
    return 0;
  }

  const [cmd, value] = args._;
  if (!cmd) {
    console.error(usage());
    return 2;
  }

  try {
    switch (cmd) {
      case 'bytes': {
        const out = formatBytes(Number(value), {
          binary: !args.flags.si,
          decimals: args.flags.decimals ?? 1,
          locale: args.flags.locale,
        });
        console.log(out);
        return 0;
      }
      case 'parse': {
        console.log(String(parseBytes(value)));
        return 0;
      }
      case 'number': {
        console.log(formatNumber(Number(value), {
          decimals: args.flags.decimals ?? 0,
          thousands: args.flags.thousands !== false,
          locale: args.flags.locale,
        }));
        return 0;
      }
      case 'compact': {
        console.log(formatCompact(Number(value), {
          style: args.flags.style ?? 'si',
          decimals: args.flags.decimals ?? 1,
        }));
        return 0;
      }
      case 'ordinal': {
        console.log(ordinal(Number(value), { lang: args.flags.lang ?? 'en' }));
        return 0;
      }
      default:
        console.error(`unknown command: ${cmd}\n`);
        console.error(usage());
        return 2;
    }
  } catch (err) {
    console.error(`quanty: ${err.message}`);
    return 1;
  }
}
