# Base85 编解码

Base85 编码工具，支持两种主流变体：

- **Ascii85（Adobe）**：字母表 `!`–`u`，全零 4 字节块用单字符 `z` 表示，常用于 PostScript / PDF 二进制段。
- **Z85（ZeroMQ）**：字母表 `0-9 a-z A-Z .-:+=^!/*?&<>()[]{}@%$#`，用于 ZeroMQ / MsgPack 等二进制帧传输。

## 功能

- **编码**：UTF-8 文本 → Base85 字符串（自动按 4 字节分组，末尾补零）。
- **解码**：Base85 字符串 → UTF-8 文本。
- 纯浏览器零依赖，数据不出本机。

## 技术说明

- 每 4 字节（32 bit）映射为 5 个 Base85 字符，标准进制算法，不依赖 BigInt。
- 解码后截除末尾填充用的零字节；对纯文本输入无影响（仅当原始字节本身以 `0x00` 结尾时会一并截除）。

## 使用

通过 [Small Tools Lab 在线页面](https://wangzifan396-wzf.github.io/small-tools-lab/projects/base85/) 使用，或本地双击 `index.html`。

## 测试

```bash
node --test tests/base85.test.js
```
