// CLI entry logic for text-forge. Parses argv, prints, but transforms live in
// core/forge.js so they can be unit-tested alone.
import {
  slugify, toCase, normalizeUnicode, removeDiacritics, width, cleanWhitespace
} from './core/forge.js';

const MODES = [
  'slugify',
  'case:camel', 'case:pascal', 'case:snake', 'case:kebab',
  'case:constant', 'case:title', 'case:lower', 'case:upper', 'case:sentence',
  'unicode:NFC', 'unicode:NFD', 'unicode:NFKC', 'unicode:NFKD',
  'nodiacritics', 'width:full', 'width:half', 'clean',
];

const USAGE = [
  '用法: text-forge <mode> "<text>"',
  '',
  '可用 mode:',
  '  ' + MODES.join('\n  '),
  '',
  '示例:',
  '  text-forge slugify "Hello 世界 World!"',
  '  text-forge case:kebab "HelloWorld Test"',
  '  text-forge width:full "ABC 123"',
].join('\n');
const VERSION = '1.0.0';

export function run(argv) {
  if (argv.includes('--help') || argv.includes('-h')) return { code: 0, out: USAGE };
  if (argv.includes('--version') || argv.includes('-v')) return { code: 0, out: VERSION };
  if (argv.length < 2) {
    return { code: 2, out: USAGE };
  }
  const mode = argv[0];
  const text = argv.slice(1).join(' ');
  const input = text == null ? '' : text;

  try {
    let out;
    if (mode === 'slugify') out = slugify(input);
    else if (mode === 'clean') out = cleanWhitespace(input);
    else if (mode.startsWith('case:')) out = toCase(input, mode.slice(5));
    else if (mode.startsWith('unicode:')) out = normalizeUnicode(input, mode.slice(7));
    else if (mode === 'nodiacritics') out = removeDiacritics(input);
    else if (mode === 'width:full') out = width(input, 'full');
    else if (mode === 'width:half') out = width(input, 'half');
    else return { code: 2, out: USAGE };
    return { code: 0, out };
  } catch (e) {
    return { code: 1, out: e.message };
  }
}
