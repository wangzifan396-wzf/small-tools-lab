# base64 · Base64 编解码

文本与 Base64 互转，**完整支持中文等 UTF-8**（用 `TextEncoder`/`TextDecoder` + `btoa`/`atob`）。

## 功能
- 编码：文本 → Base64
- 解码：Base64 → 文本（非法输入会报错）
- 一键复制结果、输入/输出互换

## 用法
直接双击 `index.html` 在浏览器打开即可（纯前端、零依赖、数据不出本机）。
