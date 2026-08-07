# Base58 编解码

采用比特币字母表（`123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz`）的 Base58 编解码工具。常用于加密货币地址、IPFS CID 等场景，相比 Base64 去掉了易混淆的 `0 O I l` 字符。

## 功能

- **编码**：文本（UTF-8）或 HEX 字节 → Base58 字符串。
- **解码**：Base58 字符串 → 文本与 HEX，方便校验原始字节。
- 编码/解码/交换/复制，纯浏览器零依赖，数据不出本机。

## 技术说明

- 基于大整数进制转换的标准算法：以 256 为基的字节序列转换为以 58 为基的字符序列，前导零字节映射为前导字符 `1`。
- 不依赖 BigInt，使用字节数组运算，兼容性更好。

## 使用

通过 [Small Tools Lab 在线页面](https://wangzifan396-wzf.github.io/small-tools-lab/projects/base58/) 使用，或本地双击 `index.html`。

## 测试

```bash
node --test tests/base58.test.js
```
