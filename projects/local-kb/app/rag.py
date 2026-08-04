from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from .chunking import chunk_text
from .documents import iter_document_paths, load_document
from .ollama_client import OllamaClient
from .store import KnowledgeStore, SearchResult


SYSTEM_PROMPT = """你是一个本地私人知识库助手。优先依据提供的资料回答。
如果资料中没有答案，请明确说“知识库里没有找到足够依据”，不要编造。
回答要简洁、具体，并在最后列出使用到的来源。"""


@dataclass
class IngestReport:
    documents: int
    chunks: int
    skipped: list[str]


@dataclass
class Answer:
    text: str
    sources: list[SearchResult]


def ingest(
    paths: list[Path],
    store: KnowledgeStore,
    client: OllamaClient,
    embed_model: str,
    max_chars: int = 1200,
    overlap: int = 180,
    reset: bool = False,
) -> IngestReport:
    if reset:
        store.clear()

    document_paths = iter_document_paths(paths)
    total_chunks = 0
    skipped: list[str] = []

    for path in document_paths:
        try:
            document = load_document(path)
            chunks = chunk_text(document.text, max_chars=max_chars, overlap=overlap)
            embedded_chunks = [(chunk, client.embed(embed_model, chunk)) for chunk in chunks]
            total_chunks += store.replace_document(str(path), path.name, embedded_chunks)
        except Exception as exc:  # Keep indexing the rest of the files.
            skipped.append(f"{path}: {exc}")

    return IngestReport(documents=len(document_paths) - len(skipped), chunks=total_chunks, skipped=skipped)


def ask(
    question: str,
    store: KnowledgeStore,
    client: OllamaClient,
    chat_model: str,
    embed_model: str,
    top_k: int = 5,
) -> Answer:
    query_embedding = client.embed(embed_model, question)
    sources = store.search(query_embedding, top_k=top_k)
    if not sources:
        return Answer(text="知识库里还没有可检索的内容。请先运行 ingest 建立索引。", sources=[])

    context = format_context(sources)
    prompt = f"""问题：
{question}

知识库资料：
{context}

请根据上面的资料回答。"""
    text = client.chat(chat_model, prompt, system_prompt=SYSTEM_PROMPT)
    return Answer(text=text, sources=sources)


def format_context(results: list[SearchResult]) -> str:
    parts = []
    for index, result in enumerate(results, start=1):
        parts.append(
            f"[来源 {index}: {result.doc_name} / chunk {result.chunk_index} / score {result.score:.3f}]\n"
            f"{result.text}"
        )
    return "\n\n---\n\n".join(parts)

