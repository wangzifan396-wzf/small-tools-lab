# Port Origin · 端口与进程溯源

只读回答“这个端口是谁占的、运行了什么命令、是谁启动它的”。支持 Windows、Linux 和 macOS，并生成完整但有深度上限的父进程链。

```sh
node bin/port-origin.js 3000
node bin/port-origin.js 5432 --format json
node bin/port-origin.js --pid 12345 --format markdown
```

Windows 使用 `netstat` 和固定的 `Win32_Process` 查询；Linux / macOS 使用 `ps`、`lsof`，Linux 缺少 `lsof` 时回退到 `ss`。报告会脱敏 token、密码参数、URL 凭据和敏感查询参数。

Port Origin 不会终止进程、关闭端口、修改服务或联网。部分系统在普通权限下会隐藏命令行或进程所有者，此时工具会保留未知字段，而不是猜测。
