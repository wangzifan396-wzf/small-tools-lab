from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from .config import DOCS_DIR
from .ollama_client import OllamaClient
from .rag import ask, ingest
from .store import KnowledgeStore


def run_server(
    host: str,
    port: int,
    store: KnowledgeStore,
    client: OllamaClient,
    chat_model: str,
    embed_model: str,
    top_k: int,
) -> None:
    class Handler(KBHandler):
        kb_store = store
        kb_client = client
        kb_chat_model = chat_model
        kb_embed_model = embed_model
        kb_top_k = top_k

    server = ThreadingHTTPServer((host, port), Handler)
    print(f"Local KB running at http://{host}:{port}")
    server.serve_forever()


class KBHandler(BaseHTTPRequestHandler):
    kb_store: KnowledgeStore
    kb_client: OllamaClient
    kb_chat_model: str
    kb_embed_model: str
    kb_top_k: int

    def log_message(self, format: str, *args: object) -> None:
        return

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path == "/":
            self.send_html(INDEX_HTML)
            return
        if path == "/api/stats":
            self.send_json(self.kb_store.stats())
            return
        self.send_error(404)

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        if path == "/api/ask":
            payload = self.read_json()
            question = str(payload.get("question", "")).strip()
            if not question:
                self.send_json({"error": "question is required"}, status=400)
                return
            answer = ask(
                question=question,
                store=self.kb_store,
                client=self.kb_client,
                chat_model=str(payload.get("chat_model") or self.kb_chat_model),
                embed_model=str(payload.get("embed_model") or self.kb_embed_model),
                top_k=int(payload.get("top_k") or self.kb_top_k),
            )
            self.send_json(
                {
                    "answer": answer.text,
                    "sources": [
                        {
                            "doc_name": item.doc_name,
                            "doc_path": item.doc_path,
                            "chunk_index": item.chunk_index,
                            "score": item.score,
                            "text": item.text,
                        }
                        for item in answer.sources
                    ],
                }
            )
            return
        if path == "/api/ingest":
            payload = self.read_json()
            raw_paths = payload.get("paths") or [str(DOCS_DIR)]
            paths = [Path(str(item)).resolve() for item in raw_paths]
            report = ingest(
                paths=paths,
                store=self.kb_store,
                client=self.kb_client,
                embed_model=str(payload.get("embed_model") or self.kb_embed_model),
                reset=bool(payload.get("reset", False)),
            )
            self.send_json({"documents": report.documents, "chunks": report.chunks, "skipped": report.skipped})
            return
        self.send_error(404)

    def read_json(self) -> dict[str, object]:
        length = int(self.headers.get("Content-Length", "0"))
        data = self.rfile.read(length) if length else b"{}"
        return json.loads(data.decode("utf-8"))

    def send_json(self, payload: dict[str, object], status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_html(self, html: str) -> None:
        body = html.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


INDEX_HTML = r"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Local KB</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f6f4ef;
      --panel: #ffffff;
      --text: #202124;
      --muted: #6b6f76;
      --line: #d8d3c7;
      --accent: #147a72;
      --accent-dark: #0b4f4a;
      --source: #f1f7f6;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", "Microsoft YaHei", Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
    }
    header {
      border-bottom: 1px solid var(--line);
      background: var(--panel);
    }
    .wrap {
      width: min(1080px, calc(100% - 32px));
      margin: 0 auto;
    }
    header .wrap {
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-height: 64px;
      gap: 16px;
    }
    h1 {
      margin: 0;
      font-size: 20px;
      font-weight: 650;
    }
    main {
      padding: 24px 0 36px;
    }
    .grid {
      display: grid;
      grid-template-columns: 320px 1fr;
      gap: 16px;
      align-items: start;
    }
    section {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 16px;
    }
    h2 {
      margin: 0 0 12px;
      font-size: 15px;
    }
    label {
      display: block;
      margin: 12px 0 6px;
      font-size: 13px;
      color: var(--muted);
    }
    input, textarea {
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 10px 11px;
      font: inherit;
      background: #fff;
    }
    textarea {
      min-height: 160px;
      resize: vertical;
      line-height: 1.55;
    }
    button {
      border: 0;
      border-radius: 6px;
      padding: 10px 13px;
      font: inherit;
      background: var(--accent);
      color: #fff;
      cursor: pointer;
    }
    button.secondary {
      background: #e9eceb;
      color: var(--accent-dark);
    }
    button:disabled {
      opacity: 0.6;
      cursor: wait;
    }
    .row {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
      margin-top: 12px;
    }
    .status {
      color: var(--muted);
      font-size: 13px;
      min-height: 20px;
      overflow-wrap: anywhere;
    }
    .answer {
      white-space: pre-wrap;
      line-height: 1.7;
      min-height: 180px;
    }
    .source {
      margin-top: 10px;
      padding: 10px;
      background: var(--source);
      border: 1px solid #cfe4e0;
      border-radius: 6px;
      font-size: 13px;
    }
    .source strong {
      display: block;
      margin-bottom: 6px;
    }
    .source p {
      margin: 0;
      color: var(--muted);
      line-height: 1.55;
      max-height: 88px;
      overflow: auto;
    }
    @media (max-width: 800px) {
      .grid { grid-template-columns: 1fr; }
      header .wrap { align-items: flex-start; flex-direction: column; padding: 14px 0; }
    }
  </style>
</head>
<body>
  <header>
    <div class="wrap">
      <h1>Local KB</h1>
      <div class="status" id="stats">Loading...</div>
    </div>
  </header>
  <main class="wrap grid">
    <section>
      <h2>索引</h2>
      <label for="path">文档目录</label>
      <input id="path" value="data/docs" />
      <label for="embed">Embedding 模型</label>
      <input id="embed" value="nomic-embed-text" />
      <div class="row">
        <button id="ingest">建立索引</button>
        <button class="secondary" id="refresh">刷新状态</button>
      </div>
      <div class="status" id="ingestStatus"></div>
    </section>
    <section>
      <h2>提问</h2>
      <label for="chat">聊天模型</label>
      <input id="chat" value="qwen3.5:4b" />
      <label for="question">问题</label>
      <textarea id="question">这个知识库项目是怎么工作的？</textarea>
      <div class="row">
        <button id="ask">发送</button>
      </div>
      <div class="status" id="askStatus"></div>
      <div class="answer" id="answer"></div>
      <div id="sources"></div>
    </section>
  </main>
  <script>
    const statsEl = document.querySelector("#stats");
    const ingestStatus = document.querySelector("#ingestStatus");
    const askStatus = document.querySelector("#askStatus");
    const answerEl = document.querySelector("#answer");
    const sourcesEl = document.querySelector("#sources");

    async function api(path, body) {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Request failed");
      return data;
    }

    async function refreshStats() {
      const response = await fetch("/api/stats");
      const data = await response.json();
      statsEl.textContent = `${data.documents} documents / ${data.chunks} chunks`;
    }

    document.querySelector("#refresh").addEventListener("click", refreshStats);

    document.querySelector("#ingest").addEventListener("click", async () => {
      const button = document.querySelector("#ingest");
      button.disabled = true;
      ingestStatus.textContent = "Indexing...";
      try {
        const data = await api("/api/ingest", {
          paths: [document.querySelector("#path").value],
          embed_model: document.querySelector("#embed").value
        });
        ingestStatus.textContent = `Indexed ${data.documents} document(s), ${data.chunks} chunk(s).`;
        if (data.skipped && data.skipped.length) {
          ingestStatus.textContent += ` Skipped ${data.skipped.length}.`;
        }
        await refreshStats();
      } catch (error) {
        ingestStatus.textContent = error.message;
      } finally {
        button.disabled = false;
      }
    });

    document.querySelector("#ask").addEventListener("click", async () => {
      const button = document.querySelector("#ask");
      button.disabled = true;
      askStatus.textContent = "Thinking...";
      answerEl.textContent = "";
      sourcesEl.innerHTML = "";
      try {
        const data = await api("/api/ask", {
          question: document.querySelector("#question").value,
          chat_model: document.querySelector("#chat").value,
          embed_model: document.querySelector("#embed").value
        });
        askStatus.textContent = "";
        answerEl.textContent = data.answer;
        sourcesEl.innerHTML = data.sources.map((source) => `
          <div class="source">
            <strong>${source.doc_name} · chunk ${source.chunk_index} · ${source.score.toFixed(3)}</strong>
            <p>${source.text.replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}</p>
          </div>
        `).join("");
      } catch (error) {
        askStatus.textContent = error.message;
      } finally {
        button.disabled = false;
      }
    });

    refreshStats();
  </script>
</body>
</html>
"""

