# Password Strength 密码强度

零依赖的密码强度分析器。基于字符池估算熵，给出 0–4 评分、粗略的离线破解耗时估算，
并列出具体弱点——同时提供 CLI 与浏览器版本。无原生编译、无网络，Node 与浏览器
行为一致。

## 命令行

```bash
node bin/password-strength.js "Tr0ub4dour&9"
printf '%s' "Tr0ub4dour&9" | node bin/password-strength.js --stdin
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
`<128` → 3，`>=128` → 4。破解估算假设离线 `1e10` 次/秒。它是透明的启发式估算，
不是安全保证；常见密码和明显模式会被限制为低分，真实密码应优先由密码管理器生成。

## 浏览器

运行 `npm start`，再打开 <http://localhost:4173/>。托管版本可以从
[Small Tools Lab 目录](https://wangzifan396-wzf.github.io/small-tools-lab/) 打开。
密码不会发送到网络，也不会写入浏览器存储。

## 测试

```bash
npm test     # node --test，零依赖
```
