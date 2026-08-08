# NATO 音标字母 (nato)

零依赖的 NATO/ICAO 音标字母转换工具：把文字编码为 `Alfa Bravo Charlie …`，或把音标词解码回文本。纯浏览器运行，无需联网。

## 功能

- **编码**：字母 A–Z、数字 0–9 转为对应 NATO 词（如 `S` → `Sierra`，`5` → `Five`）。
- **解码**：音标词（大小写不敏感、支持逗号/空格分隔）还原为字母与数字。
- **标点保留**：非字母数字字符在编码时原样内联；解码时无法由空白分隔重建的空格会被丢弃（音标本质只表达字母与数字，符合 NATO 惯例）。
- **字母表速查**：一键列出 26 字母 + 10 数字的完整映射。

## 用法

```js
const N = require("./src/nato.js");
N.encode("ABC");                 // "Alfa Bravo Charlie"
N.decode("Alfa Bravo Charlie");  // "ABC"
N.decode("alfa, bravo");         // "AB"
N.encode("SOS 123");             // "Sierra Oscar Sierra One Two Three"
N.decode(N.encode("SOS123"));    // "SOS123"
```

## 说明

- 字母表采用 ICAO 标准拼写（X-ray、Juliett 等均为官方写法）。
- 解码时未知词（如标点）按原样保留，便于核对。

## 测试

```bash
node --test tests/nato.test.js
```
