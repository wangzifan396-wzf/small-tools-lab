# Password Strength 密码强度

零依赖的密码强度分析器。基于字符池估算熵，给出 0–4 评分、粗略的离线破解耗时估算，
并列出具体弱点——同时提供 CLI 与浏览器版本。无原生编译、无网络，Node 与浏览器
行为一致。

## 命令行

```bash
node bin/password-strength.js "Tr0ub4dour&9"
```

输出评分（0–4）、熵（bits）、粗略破解耗时估算、触发的检查项（太短、缺少字符类、
连续序列、重复、常见密码）以及改进建议。

## 作为库

```js
import { analyze } from './src/index.js';

analyze('Tr0ub4dour&9');
// { score, entropyBits, crackEstimate, timeToCrack, length, flags, suggestions }
```

熵按出现的字符类估算字符池——小写 26、大写 26、数字 10、符号约 32——因此
`bits = length × log2(pool)`。评分分段：`<28` → 0（非常弱），`<36` → 1，`<60` → 2，
`<128` → 3，`>=128` → 4。破解估算假设离线 `1e10` 次/秒。

## 浏览器

直接打开 `playground/index.html`（可在 `file://` 下运行），或 `start` 启动本地服务。
实时强度条——按中文 UI 习惯弱=红、强=绿——熵读数、达标清单与建议。

## 测试

```bash
npm test     # node --test，零依赖
```
