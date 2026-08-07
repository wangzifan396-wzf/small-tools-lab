# hash

浏览器端哈希校验台：计算文本的 MD5 / SHA-1 / SHA-256 / SHA-384 / SHA-512 摘要与 HMAC，也支持拖入文件生成校验和。

## 特性
- MD5 内置纯 JS 实现；SHA 系列基于 Web Crypto `crypto.subtle.digest`（零依赖、高安全）。
- 支持 HMAC（SHA 系列，可选密钥）。
- 文本与文件两种输入；结果可复制 hex 与 base64。
- 纯前端，数据不出本机。

## 用法
打开 `index.html`，输入文本或拖入文件，选择算法即实时输出。HMAC 密钥留空则仅计算摘要。
