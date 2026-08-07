# Punycode / IDN 转换

基于 RFC 3492 的 Punycode 编解码工具，用于国际化域名（IDN，如中文域名、含 emoji 的域名）与 `xn--` 编码之间的互转。纯浏览器零依赖。

## 功能

- **toASCII**：将含 Unicode 的域名转为 Punycode 兼容的 ASCII 形式（非 ASCII 标签加 `xn--` 前缀）。
- **toUnicode**：将 `xn--` 形式的域名还原为可读的 Unicode 域名。
- 支持整域名（按 `.` 拆分标签分别处理），数据不出本机。

## 技术说明

- 实现 bootstring 算法：基本码点复制、增量 delta 编码、自适应偏置 `adapt()`。
- 已知向量验证：`maana-pta` ⇄ `mañana`；`例子.中国` → `xn--fsqu00a.xn--fiqs8s`。

## 使用

通过 [Small Tools Lab 在线页面](https://wangzifan396-wzf.github.io/small-tools-lab/projects/punycode/) 使用，或本地双击 `index.html`。

## 测试

```bash
node --test tests/punycode.test.js
```
