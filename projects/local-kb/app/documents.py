from __future__ import annotations

import csv
import json
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path

from .chunking import normalize_text


SUPPORTED_EXTENSIONS = {
    ".txt",
    ".md",
    ".markdown",
    ".csv",
    ".json",
    ".html",
    ".htm",
    ".pdf",
}


@dataclass(frozen=True)
class Document:
    path: Path
    text: str


class TextHTMLParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        if data.strip():
            self.parts.append(data.strip())

    def text(self) -> str:
        return "\n".join(self.parts)


def iter_document_paths(paths: list[Path]) -> list[Path]:
    files: list[Path] = []
    for path in paths:
        if path.is_dir():
            for child in path.rglob("*"):
                if child.is_file() and child.suffix.lower() in SUPPORTED_EXTENSIONS:
                    files.append(child)
        elif path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS:
            files.append(path)
    return sorted(files)


def load_document(path: Path) -> Document:
    suffix = path.suffix.lower()
    if suffix in {".txt", ".md", ".markdown"}:
        text = read_text(path)
    elif suffix == ".csv":
        text = read_csv(path)
    elif suffix == ".json":
        text = read_json(path)
    elif suffix in {".html", ".htm"}:
        text = read_html(path)
    elif suffix == ".pdf":
        text = read_pdf(path)
    else:
        raise ValueError(f"Unsupported file type: {path}")
    return Document(path=path, text=normalize_text(text))


def read_text(path: Path) -> str:
    for encoding in ("utf-8", "utf-8-sig", "gb18030"):
        try:
            return path.read_text(encoding=encoding)
        except UnicodeDecodeError:
            continue
    return path.read_text(errors="ignore")


def read_csv(path: Path) -> str:
    content = read_text(path)
    rows = []
    for row in csv.reader(content.splitlines()):
        rows.append(" | ".join(cell.strip() for cell in row if cell.strip()))
    return "\n".join(row for row in rows if row)


def read_json(path: Path) -> str:
    data = json.loads(read_text(path))
    return json.dumps(data, ensure_ascii=False, indent=2)


def read_html(path: Path) -> str:
    parser = TextHTMLParser()
    parser.feed(read_text(path))
    return parser.text()


def read_pdf(path: Path) -> str:
    try:
        from pypdf import PdfReader  # type: ignore
    except ImportError as exc:
        raise RuntimeError("PDF support requires pypdf. Install it with: py -3.10 -m pip install pypdf") from exc

    reader = PdfReader(str(path))
    pages = []
    for index, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""
        if text.strip():
            pages.append(f"[Page {index}]\n{text}")
    return "\n\n".join(pages)

