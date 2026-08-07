# 二维码生成器 · QR Code

纯前端、零依赖的二维码（QR Code）生成器。采用字节模式（Byte Mode），支持版本 1–10 与 L / M / Q / H 四种纠错等级，直接在浏览器本地编码，**数据不出本机**。可导出 PNG 与 SVG，支持复制图片到剪贴板。

## 功能

- 字节模式编码，UTF-8 文本 / 链接均可用（含中文等多字节字符）。
- 纠错等级 L / M / Q / H 一键切换，实时预览。
- 版本自动选择（1–10），显示版本号与模块尺寸。
- 导出 PNG（高清栅格）与 SVG（矢量，可无限缩放）。
- 复制二维码图片到剪贴板（支持的浏览器）。

## 技术说明

- 自实现 GF(256) 伽罗瓦域与 Reed-Solomon 纠错，不依赖任何第三方库。
- 完整实现定位图案、对齐图案、时序图案、格式信息（BCH）、版本信息（v≥7，BCH）与 8 种掩码。
- 编码器已通过黄金参考库（node `qrcode`）逐位比对验证：在字节模式下，所有纠错等级与多种输入（含中文、JSON、URL、长文本）生成的模块矩阵与参考实现完全一致。

## 使用

通过 [Small Tools Lab 在线页面](https://wangzifan396-wzf.github.io/small-tools-lab/projects/qrcode/) 使用，或在本地双击 `index.html` 打开（无需服务器）。

## 测试

```bash
node --test tests/qrcode.test.js
```

校验 GF 表一致性、Reed-Solomon 码字校验、结构不变量（定位/时序/暗模块）与多 RS 块正确性。
