# Text Forge 文本锻造

零依赖的文本转换工具箱。Slugify（Unicode 感知，保留中文）、大小写转换
（camel/pascal/snake/kebab/constant/title/lower/upper/sentence）、Unicode 归一化
（NFC/NFD/NFKC/NFKD）、去除变音符号、全角/半角转换、空白清理——同时提供 CLI 与
浏览器版本。无原生编译、无网络，Node 与浏览器行为一致。

## 命令行

```bash
node bin/text-forge.js slugify "Hello 世界 World!"
node bin/text-forge.js case:kebab "HelloWorld Test"
node bin/text-forge.js width:full "ABC 123"
node bin/text-forge.js unicode:NFKC "Ｈｅｌｌｏ"
node bin/text-forge.js nodiacritics "café"
node bin/text-forge.js clean "  a   b  "
```

直接运行 `node bin/text-forge.js` 可列出全部 mode。

## 作为库

```js
import { slugify, toCase, normalizeUnicode, removeDiacritics, width, cleanWhitespace } from './src/index.js';

slugify('Hello 世界', { lower: true, sep: '-' });  // 'hello-世界'
toCase('helloWorld', 'snake');                      // 'hello_world'
removeDiacritics('café');                           // 'cafe'
toFullWidth('A 1');                                 // 'Ａ　１'
```

## 测试

```bash
npm test     # node --test，零依赖
```
