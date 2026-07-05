# Small Tools Lab

一些日常做实验时写的小工具，偏本地优先、自用优先，但整理成了可以公开查看和复用的仓库。

## Contents

- `local-kb/`：本地知识库工具。使用 Ollama embedding、SQLite 向量存储和本地聊天模型做简单 RAG 问答。
- `screenshot-qa/`：截图问答工具。先用 OCR 提取截图文字，再交给本地 Ollama 模型或 DeepSeek API 分析。
- `Auto Run Docs/`：自动任务运行相关的记录和任务队列文档。
- `index.html`、`app.js`、`style.css`：一个简单的浏览器待办清单页面。

## Notes

这个仓库不会提交本地运行产物和私有数据，例如虚拟环境、Python 缓存、截图历史、SQLite 数据库、Playwright 临时状态和 `.env` 文件。需要 API Key 的功能请通过环境变量配置，不要写进代码或提交到仓库。

各子项目的具体运行方式见对应目录下的 `README.md`。

## License

MIT
