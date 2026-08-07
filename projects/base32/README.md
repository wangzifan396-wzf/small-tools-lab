# Base32 编解码

Base32 编码工具，支持 **RFC 4648**（带 `=` 填充，字母表 `A–Z 2–7`）与 **Crockford**（无填充，字母表 `0–9 A–Z` 去掉 `I L O U`，常用于人类可读场景，如激活码）。

## 功能

- **编码**：UTF-8 文本 → Base32 字符串，可切换 RFC 4648 / Crockford 两种变体。
- **解码**：Base32 字符串 → UTF-8 文本；Crockford 变体会自动归一化大小写、连字符，并将 `I/L` 视作 `1`、`O` 视作 `0`。
- 纯浏览器零依赖，数据不出本机。

## 技术说明

- 标准 5-bit 分组算法：字节流拼接为比特缓冲，每 5 bit 映射到一个字母；RFC 4648 按 8 字符一组补 `=`。
- 不依赖 BigInt，适用于任意长度输入。

## 使用

通过 [Small Tools Lab 在线页面](https://wangzifan396-wzf.github.io/small-tools-lab/projects/base32/) 使用，或本地双击 `index.html`。

## 测试

```bash
node --test tests/base32.test.js
```
