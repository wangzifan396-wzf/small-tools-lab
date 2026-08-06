# jwtpeek

零依赖的 **JWT 解码器**。粘贴一个 JSON Web Token，立即看到它的 header、
payload、签名与过期时间 —— 全程在浏览器或 CLI 中完成。无网络、无依赖、无构建。

> ⚠️ **仅解码，不校验签名。** 任何人都可伪造 token，请勿仅凭解码结果信任身份。

## 功能

- 解码 `header.payload.signature`（base64url），UTF-8 安全
- 将 `exp` / `iat` / `nbf` 显示为可读的 UTC 时间
- 明确的判定：**有效** · **已过期** · **尚未生效**（nbf） · **永不过期**
- 优雅处理未签名 token（空签名）
- CLI + 浏览器 playground —— 同一套逻辑，零依赖

## 浏览器

直接双击打开 `index.html`，或启动本地服务：

```bash
node playground/serve.js      # 或：npm start
# → http://localhost:4173/
```

## 命令行

```bash
jwtpeek "<token>"                 # 解码 + 摘要
jwtpeek "<token>" --json          # 完整解析（JSON）
jwtpeek "<token>" --header        # 仅 header
jwtpeek "<token>" --payload       # 仅 payload
jwtpeek --help
```

## API

```js
import { parse, summarize } from "jwtpeek";

const r = parse(token);
// r.valid, r.header, r.payload, r.hasSignature, r.timing.status ...

const { code, out } = summarize(token);
```

`timing.status` 取值：`valid` | `expired` | `not-yet` | `no-exp`。

## 测试

```bash
npm test
```

## 许可证

MIT
