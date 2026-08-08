# TOTP 动态口令生成器

零依赖、纯本地运行的 RFC 6238 一次性口令（TOTP）生成器。可对照 Google Authenticator、Microsoft Authenticator、1Password 等任意验证器 App，支持 SHA-1 / SHA-256 / SHA-512 三种哈希算法。

## 特性

- **RFC 6238 兼容**：与主流验证器 App 生成的 6/8 位动态口令完全一致。
- **多算法**：SHA-1（默认）、SHA-256、SHA-512。
- **密钥格式灵活**：自动识别 Base32（验证器导出）、Hex、纯文本三种密钥。
- **倒计时自动刷新**：按步长（30/60 秒）自动刷新口令并显示剩余秒数。
- **一键导出**：生成 `otpauth://` 链接，可直接扫码导入验证器。
- **纯前端**：SHA/HMAC 全部用原生 JavaScript 实现（含 BigInt SHA-512），`file://` 双击即跑，无需 Web Crypto，数据不出本机。

## 用法

1. 填入验证器提供的密钥（通常为 Base32，如 `JBSWY3DPEHPK3PXP`）。
2. 选择算法、位数、周期，点击「生成 / 自动刷新」。
3. 将显示的口令与手机验证器对照；倒计时归零后自动生成下一个。
4. 可选填写发行方与账号，点击「生成 otpauth 链接」得到可导入的 URI。

## 校验

代码通过 RFC 6238 附录 B 官方向量验证：密钥 `12345678901234567890`（ASCII，SHA-1，8 位，周期 30 秒）在 `T=59` 时结果为 `94287082`。SHA-1/256/512 与 HMAC 均与 Node `crypto` 参考实现逐字节对齐。

## API

```js
Totp.totpToken(secret, { algo, digits, period, t })  // 生成当前 TOTP 字符串
Totp.remaining(period)                               // 当前步长剩余秒数
Totp.otpUri({ secret, issuer, account, algo, digits, period }) // 生成导入 URI
Totp.decodeSecret(secret)                            // 解析 Base32/Hex/文本密钥为字节
```

## 说明

- 纯数字密钥会被当作 ASCII 文本而非 Hex（避免误读 RFC 测试向量）；含 a–f 的十六进制串仍按 Hex 解析。
- SHA-512 使用 BigInt 精确运算，所有 80 个轮常量经整数立方根严格校验。
