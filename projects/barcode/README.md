# 条形码生成（Code 128）

生成 **Code 128（Code B）** 一维条形码。Code B 覆盖全部可打印 ASCII（32–127），自动计算校验位并渲染为可缩放的 SVG，可直接打印或下载。

## 功能

- **生成**：输入文本（ASCII 32–127）→ 标准 Code 128 条形码 SVG，含两侧静区（quiet zone）。
- **校验**：按规范计算校验字符（checksum），保证符号可被扫码设备识别。
- 纯浏览器零依赖，数据不出本机；可复制 SVG 源码或下载 `.svg`。

## 技术说明

- 采用 Code B 字符集：字符 `c`（ASCII `code`）映射为值 `code − 32`。
- 符号序列：起始符 `Start B`(105) + 数据值 + 校验值(总和对 103 取模) + 终止符(106)。
- 每个值映射为 6 段条/空宽度（共 11 模块），终止符为 13 模块；以黑白矩形渲染为 SVG。

## 使用

通过 [Small Tools Lab 在线页面](https://wangzifan396-wzf.github.io/small-tools-lab/projects/barcode/) 使用，或本地双击 `index.html`。

## 测试

```bash
node --test tests/barcode.test.js
```
