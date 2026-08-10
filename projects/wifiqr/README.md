# WiFi 二维码生成器 · WifiQR

纯前端、零依赖的 WiFi 配置二维码生成器。输入 SSID、密码、加密方式，即可生成手机扫码即连的二维码。复用项目内的二维码编码器（`../qrcode`），双击 `index.html` 离线运行，数据不出本机。

## 功能

- 支持 **WPA / WPA2 / WPA3**、**WEP** 与**开放网络（无密码）**
- 可选**隐藏网络**（`H:true`）
- 自动转义 SSID / 密码中的特殊字符：`\ ; , " :`
- 生成标准 `WIFI:S:..;T:..;P:..;H:..;;` 负载
- 可下载 PNG / SVG，支持 L/M/Q/H 纠错等级

## 用法

浏览器：打开 [`index.html`](index.html)，填写后实时生成二维码。

模块 / 命令行：

```js
const W = require("./src/wifiqr.js");
W.buildWifiString({ ssid: "MyWiFi", password: "secret123", encryption: "WPA" });
// => "WIFI:S:MyWiFi;T:WPA;P:secret123;;"
```

## 负载格式

遵循 WiFi QR 规范：

```
WIFI:S:<ssid>;T:<WPA|WEP|nopass>;P:<password>;H:<true|false>;;
```

特殊字符需以反斜杠转义，以避免解析歧义。

## 测试

```bash
node --test tests/wifiqr.test.js
```
