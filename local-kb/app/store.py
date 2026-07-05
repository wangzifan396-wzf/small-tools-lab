from __future__ import annotations

import json
import math
import sqlite3
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class SearchResult:
    chunk_id: int
    doc_path: str
    doc_name: str
    chunk_index: int
    text: str
    score: float


class KnowledgeStore:
    def __init__(self, db_path: Path) -> None:
        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.init()

    def init(self) -> None:
        with self.connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS chunks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    doc_path TEXT NOT NULL,
                    doc_name TEXT NOT NULL,
                    chunk_index INTEGER NOT NULL,
                    text TEXT NOT NULL,
                    embedding TEXT NOT NULL,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            conn.execute("CREATE INDEX IF NOT EXISTS idx_chunks_doc_path ON chunks(doc_path)")

    def connect(self) -> sqlite3.Connection:
        return sqlite3.connect(self.db_path)

    def clear(self) -> None:
        with self.connect() as conn:
            conn.execute("DELETE FROM chunks")

    def replace_document(self, doc_path: str, doc_name: str, chunks: list[tuple[str, list[float]]]) -> int:
        with self.connect() as conn:
            conn.execute("DELETE FROM chunks WHERE doc_path = ?", (doc_path,))
            conn.executemany(
                """
                INSERT INTO chunks (doc_path, doc_name, chunk_index, text, embedding)
                VALUES (?, ?, ?, ?, ?)
                """,
                [
                    (doc_path, doc_name, index, text, json.dumps(embedding))
                    for index, (text, embedding) in enumerate(chunks)
                ],
            )
        return len(chunks)

    def stats(self) -> dict[str, int]:
        with self.connect() as conn:
            chunks = conn.execute("SELECT COUNT(*) FROM chunks").fetchone()[0]
            docs = conn.execute("SELECT COUNT(DISTINCT doc_path) FROM chunks").fetchone()[0]
        return {"documents": int(docs), "chunks": int(chunks)}

    def search(self, query_embedding: list[float], top_k: int = 5) -> list[SearchResult]:
        rows = []
        with self.connect() as conn:
            cursor = conn.execute("SELECT id, doc_path, doc_name, chunk_index, text, embedding FROM chunks")
            for row in cursor:
                embedding = json.loads(row[5])
                score = cosine_similarity(query_embedding, embedding)
                rows.append(
                    SearchResult(
                        chunk_id=int(row[0]),
                        doc_path=str(row[1]),
                        doc_name=str(row[2]),
                        chunk_index=int(row[3]),
                        text=str(row[4]),
                        score=score,
                    )
                )
        rows.sort(key=lambda item: item.score, reverse=True)
        return rows[:top_k]


def cosine_similarity(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)

