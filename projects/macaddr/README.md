# MAC 地址工具 (macaddr)

零依赖的 MAC 地址处理工具：规范化、任意分隔符重排、随机生成、OUI 厂商识别，并解析单播/多播与本地/全局管理位。纯浏览器运行，无需联网。

## 功能

- **规范化**：把 `aabb.cc00.1234`、`AA-BB-CC-00-12-34`、`aabbcc001234` 等任意写法统一为 `AA:BB:CC:00:12:34`。
- **重排分隔符**：冒号 `:`、连字符 `-`、点 `.`、无分隔四种输出；支持大小写切换。
- **随机生成**：可固定厂商 OUI 前缀、可选本地管理位（默认置位）与多播位。
- **OUI 厂商识别**：内置常见厂商前缀表（Apple / Cisco / Samsung / Huawei / Xiaomi / Google / Microsoft / Intel / TP-LINK / VMware / Raspberry Pi 等），返回厂商名。
- **位解析**：识别 I/G 位（单播/多播）与 U/L 位（全局/本地管理）。

## 用法

```js
const M = require("./src/macaddr.js");
M.normalize("aabb.cc00.1234");   // "AA:BB:CC:00:12:34"
M.format("aabbcc001234", "-", true); // "AA-BB-CC-00-12-34"
M.vendor("00:1B:63:AA:BB:CC");  // { vendor: "Apple, Inc.", oui: "001B63" }
M.isMulticast("01:00:00:00:00:00"); // true
M.isLocal("AA:BB:CC:00:12:34");  // true
M.random({ oui: "001B63" });     // "00:1B:63:xx:xx:xx"
```

## 说明

- 厂商识别基于内置 OUI 子集，主要覆盖消费电子与网络设备大厂；未在表中的前缀返回「未知」。
- 固定 OUI 生成时保留原厂前缀的本地/全局位；不固定时默认生成本地管理位的单播地址（符合随机 MAC 惯例）。
- 非 12 位十六进制输入会被安全拒绝（`toHex` 返回 `null`）。

## 测试

```bash
node --test tests/macaddr.test.js
```
