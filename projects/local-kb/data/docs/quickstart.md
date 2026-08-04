# Local KB 示例资料

Local KB 是一个本地私人知识库项目。它会读取 `data/docs` 目录里的文档，把文档拆分成小段，再调用 Ollama 的 embedding 模型生成向量。

索引结果会保存到 `data/kb.sqlite`。提问时，程序先把问题也转换成向量，然后在 SQLite 里找出最相关的文档片段，最后把这些片段交给聊天模型回答。

默认聊天模型是 `qwen3.5:4b`，默认 embedding 模型是 `nomic-embed-text`。如果更换 embedding 模型，需要重新建立索引。

这个项目适合保存课程笔记、项目文档、读书笔记、网页摘录和个人资料。对于敏感资料，建议使用本地 embedding、本地向量库和本地聊天模型。

