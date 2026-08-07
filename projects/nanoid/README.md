# nanoid

安全随机 ID / Token 生成器。

## 特性
- 基于 Web Crypto `crypto.getRandomValues`，采用拒绝采样消除取模偏差。
- 自定义长度、字母表（默认 URL-safe，nanoid 兼容）、批量数量（最多 500）。
- 一键复制全部 / 首条。
- 纯前端零依赖。

## 用法
打开 `index.html`，设置长度 / 字母表 / 数量，点「生成」。
