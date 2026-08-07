# curl → 代码

零依赖、纯前端的 curl 转换器。把一段 `curl` 命令一键转成 JavaScript（`fetch`）与 Python（`requests`）代码，方便直接粘贴进项目。

## 支持的 curl 参数
- `-X` / `--request`：请求方法（GET / POST / PUT / DELETE …）
- `-H` / `--header`：请求头（自动识别 `Content-Type` / `Authorization` / `Cookie`…）
- `-d` / `--data` / `--data-raw` / `--data-binary` / `--data-urlencode`：请求体（JSON 自动 `JSON.stringify`）
- `-u` / `--user`：Basic 认证，转为 `Authorization: Basic base64(...)`
- `-b` / `--cookie`：Cookie，转为请求头
- `-k` / `--insecure`：忽略证书校验
- `--url`：显式 URL

## 输出
- **JavaScript**：`fetch(url, { method, headers, body })` + `await` 调用骨架。
- **Python**：`requests.request(method, url, headers=, json=/data=, auth=)`。

数据完全在浏览器本机解析，不上传任何内容。

## 用法
打开 `index.html`，粘贴 curl 命令，点「转换」，切换标签页复制 JS 或 Python。

## 实现
`src/curlcon.js`，UMD 模块，导出 `parse` / `convert` / `toJs` / `toPython`，无第三方依赖。`node --test` 覆盖方法 / URL / 请求头 / 认证 / JSON 体解析。
