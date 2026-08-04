# Local KB

一个本地私人知识库项目。它把文档切成小段，用 Ollama embedding 模型生成向量，保存到本地 SQLite，然后在提问时检索相关片段，再交给聊天模型回答。

默认配置适配你当前的机器：

- Ollama 地址：`http://127.0.0.1:11434`
- 聊天模型：`qwen3.5:4b`
- Embedding 模型：`nomic-embed-text`
- 知识库目录：`data/docs`
- 索引数据库：`data/kb.sqlite`

## 1. 启动 Ollama

先确认 Ollama 服务正在运行：

```powershell
ollama list
```

如果提示连不上服务，可以先运行：

```powershell
ollama serve
```

## 2. 准备 embedding 模型

```powershell
ollama pull nomic-embed-text
```

如果中文资料很多，也可以换成：

```powershell
ollama pull bge-m3
```

索引时和提问时要使用同一个 embedding 模型。更换 embedding 模型后，需要重新索引文档。

## 3. 放入资料

把资料放到：

```text
local-kb\data\docs
```

当前版本支持：`.txt`、`.md`、`.markdown`、`.csv`、`.json`、`.html`、`.htm`。

PDF 支持是可选的。如果你安装了 `pypdf`，也可以读取 `.pdf`：

```powershell
py -3.10 -m pip install pypdf
```

## 4. 建立索引

在 `local-kb` 目录运行：

```powershell
py -3.10 -m app ingest
```

也可以指定目录：

```powershell
py -3.10 -m app ingest E:\your-docs
```

## 5. 提问

```powershell
py -3.10 -m app ask "这个知识库项目是怎么工作的？"
```

使用别的模型：

```powershell
py -3.10 -m app ask "总结一下我的资料" --chat-model qwen3.5:4b
```

## 6. 打开网页界面

```powershell
py -3.10 -m app serve
```

然后访问：

```text
http://127.0.0.1:8765
```

也可以用 PowerShell 脚本：

```powershell
.\run.ps1 serve
```

## 7. 切换到 API 模型

这个项目把“知识库检索”和“聊天模型回答”分开了。现在内置的是 Ollama 本地聊天模型调用。以后可以在 `app/ollama_client.py` 旁边加一个 OpenAI-compatible 客户端，然后在 `app/cli.py` 和 `app/server.py` 里切换 provider。

保持本地隐私的推荐方式：

```text
Embedding: Ollama 本地
Vector DB: SQLite 本地
Chat Model: 本地 qwen3.5:4b，或需要时切 API
```

如果使用 API 聊天模型，提问和检索出来的相关文档片段会发送给 API 服务商。

