# RSA 密钥生成与加解密 (rsa)

零依赖的纯 JavaScript RSA 实现：生成密钥对（Miller–Rabin 素数检测）、用公钥加密、用私钥解密。采用 **PKCS#1 v1.5** 填充，与 OpenSSL / Node `crypto`（`RSA_PKCS1_PADDING`）**完全互通**。纯浏览器运行，使用 Web Crypto 安全随机源，`file://` 双击即跑。

## 功能

- **密钥生成**：默认 1024-bit（约 0.1–0.3s），可选 2048-bit；指数固定 `e = 65537`；输出 `n / e / d` 十六进制，并校验 `n = p × q`、`e·d ≡ 1 (mod φ(n))`。
- **加密**：输入 UTF-8 明文 + 公钥 `(n, e)`，输出十六进制密文。单次最大明文长度 = `keyBytes − 11`（1024-bit 为 117 字节）。
- **解密**：输入十六进制密文 + 私钥 `(n, d)`，恢复明文。
- **互通验证**：Node `crypto.publicEncrypt` 产生的密文可被本工具私钥解密，反之亦然（测试已覆盖）。

## 用法

```js
const RSA = require("./src/rsa.js");
const kp = RSA.keygen(1024);
const ct = RSA.encrypt("secret", kp.n, kp.e);   // hex string
const pt = RSA.decrypt(ct, kp.n, kp.d);          // "secret"
```

## 说明 / 安全提示

- 素数检测为概率性（Miller–Rabin，16 轮），1024-bit 冲突概率可忽略。
- 这是**教学 / 离线工具**，随机数来自 `crypto.getRandomValues`（浏览器）或 `crypto.randomBytes`（Node）。请勿用于生产密钥——真实场景请用经过审计的密码学库。
- 仅实现 RSAES-PKCS1-v1_5 加密体系，不含签名（RSASSA）与 OAEP。

## 测试

```bash
node --test tests/rsa.test.js
```
覆盖：modExp / modInverse / isProbablePrime 基础用例、密钥不变量、明文往返（含中文与 100 字节）、与 Node `crypto` 的双向互通。
