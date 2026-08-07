# URL 编解码 (url-encode)

零依赖的 URL 百分号编码 / 解码工具。在浏览器里双向转换，数据不出本机。

## 功能
- 文本 → Percent-encoding（UTF-8，符合 `encodeURIComponent`）。
- 编码结果 → 原始文本（`decodeURIComponent`，含非法序列会给出可读报错）。
- 一键「互换」输入与结果、「复制结果」。
- 可选「空格 → `+`」模式，兼容 `application/x-www-form-urlencoded` 表单格式。

## 用法
打开 `index.html`，在「原始文本」框输入内容，点「编码 →」或「← 解码」。

适合拼接链接、调试接口参数、处理中文/特殊字符 URL。纯前端、无网络、无依赖。
