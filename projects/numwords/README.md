# numwords · 数字转英文单词

把整数写成英文单词。支票、合同、发票、读屏场景里经常需要「数字 → 英文单词」，这个工具一行搞定。

## 特性

- 支持 **0、正整数、负整数**，范围至 quadrillion（10¹⁵）量级。
- 可选 **英式 `and`**（如 *one hundred and one*），贴合英式英语书写习惯。
- 自动按千位分组并加逗号（*one thousand, two hundred and thirty-four*）。
- **离线零依赖**：纯浏览器运行。

## 用法

打开 `index.html`，输入整数，实时得到英文单词；可切换「英式 and」，结果可一键复制。

## 注意

- 仅处理整数（小数部分会被取整）。
- 超过 quadrillion 会报错，属设计内的安全边界。

## 开发

```bash
npm test
```
