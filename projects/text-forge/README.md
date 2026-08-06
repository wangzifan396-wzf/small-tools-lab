# Text Forge

Zero-dependency text transformation toolkit. Slugify (Unicode-aware, keeps
CJK), case conversion (camel/pascal/snake/kebab/constant/title/lower/upper/
sentence), Unicode normalization (NFC/NFD/NFKC/NFKD), diacritic removal, full/
half-width conversion, and whitespace cleaning — for the CLI and the browser.
No native build, no network, works in Node and the browser the same way.

## CLI

```bash
node bin/text-forge.js slugify "Hello 世界 World!"
node bin/text-forge.js case:kebab "HelloWorld Test"
node bin/text-forge.js width:full "ABC 123"
node bin/text-forge.js unicode:NFKC "Ｈｅｌｌｏ"
node bin/text-forge.js nodiacritics "café"
node bin/text-forge.js clean "  a   b  "
```

Run `node bin/text-forge.js` with no args to list every mode.

## Library

```js
import { slugify, toCase, normalizeUnicode, removeDiacritics, width, cleanWhitespace } from './src/index.js';

slugify('Hello 世界', { lower: true, sep: '-' });  // 'hello-世界'
toCase('helloWorld', 'snake');                      // 'hello_world'
removeDiacritics('café');                           // 'cafe'
toFullWidth('A 1');                                 // 'Ａ　１'
```

## Test

```bash
npm test     # node --test, zero dependencies
```
