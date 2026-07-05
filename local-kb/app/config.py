from __future__ import annotations

import os
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_ROOT / "data"
DOCS_DIR = DATA_DIR / "docs"
DB_PATH = DATA_DIR / "kb.sqlite"

DEFAULT_OLLAMA_HOST = os.getenv("KB_OLLAMA_HOST", "http://127.0.0.1:11434")
DEFAULT_CHAT_MODEL = os.getenv("KB_CHAT_MODEL", "qwen3.5:4b")
DEFAULT_EMBED_MODEL = os.getenv("KB_EMBED_MODEL", "nomic-embed-text")
DEFAULT_TOP_K = int(os.getenv("KB_TOP_K", "5"))


def ensure_data_dirs() -> None:
    DOCS_DIR.mkdir(parents=True, exist_ok=True)
    DATA_DIR.mkdir(parents=True, exist_ok=True)

