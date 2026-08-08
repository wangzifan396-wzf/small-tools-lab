# 哈希类型识别器

零依赖的哈希类型识别器：根据哈希字符串的**前缀、长度、字符集**推断其可能的算法。常用于安全审计、CTF、日志排查时快速判断一段摘要属于 MD5 / SHA 系列 / bcrypt / Argon2 等哪一种。纯前端，数据不出本机。

## 特性

- **口令哈希格式**：bcrypt（`$2a$`）、Argon2（`$argon2`）、scrypt、PBKDF2、Unix crypt（`$1$`/`$5$`/`$6$`）、phpass（`$P$`/`$H$`，WordPress）。
- **按长度识别（hex）**：
  - 8 位 → CRC32
  - 32 位 → MD5 / NTLM / MD4 / LM / RIPEMD-128 / HAVAL-128 / Tiger-128
  - 40 位 → SHA-1 / RIPEMD-160 / HAVAL-160
  - 56 位 → SHA-224
  - 64 位 → SHA-256 / SHA3-256 / Keccak-256 / BLAKE2s
  - 96 位 → SHA-384
  - 128 位 → SHA-512 / Whirlpool / BLAKE2b
- **Base64 编码哈希**：依字符数推断 MD5(≈22) / SHA-1(≈28) / SHA-256(≈44) / SHA-512(≈88)。
- **自动清理**：忽略空格、冒号、连字符等分隔符（如 LM 哈希 `AAD3B435B51404EE`）。

## 用法

粘贴任意哈希值，点击「识别」或输入即实时显示候选算法及说明。

## API

```js
Hashid.identify(hashString) // => [{ name, note }, ...]
```

## 说明

- 这是**启发式识别**，同一长度可能对应多种算法，结果以候选列表呈现，不做唯一判定，也不还原明文。
- 带标准 `$` 前缀的口令哈希为唯一确定，优先返回。
