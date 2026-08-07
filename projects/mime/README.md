# MIME 类型查询

零依赖、可离线运行的 MIME 类型查询工具。在「扩展名 → MIME 类型」与「MIME 类型 → 扩展名」两个方向互查，并提示文本类类型的 `charset`。

## 功能
- 扩展名 / 文件名 → MIME 类型（自动忽略 `.` 与多余路径段，大小写不敏感）
- MIME 类型 → 常见扩展名列表
- 文本类类型（text/*、application/json、*+xml、*+json 等）提示 `charset: UTF-8`
- 内建约 120 条常用映射（web / 图片 / 音视频 / 字体 / 文档 / 压缩 / 代码 等）

## 用法
打开 `index.html`，输入 `app.js` 或 `.png` 查类型；切换到「查扩展名」模式输入 `image/jpeg` 查扩展名。

## 实现
- `src/mime.js`：UMD 模块，导出 `lookup / extensions / charset`
- `tests/mime.test.js`：4 个用例（双向映射、未知值、charset 提示）

## 注意
内建表覆盖常用类型；极小众扩展名可能未收录（会提示「未知类型」）。
