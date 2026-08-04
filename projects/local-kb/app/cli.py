from __future__ import annotations

import argparse
import json
from pathlib import Path

from .config import DB_PATH, DEFAULT_CHAT_MODEL, DEFAULT_EMBED_MODEL, DEFAULT_OLLAMA_HOST, DEFAULT_TOP_K, DOCS_DIR, ensure_data_dirs
from .ollama_client import OllamaClient
from .rag import ask, ingest
from .server import run_server
from .store import KnowledgeStore


def main(argv: list[str] | None = None) -> None:
    ensure_data_dirs()
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.command == "check":
        client = OllamaClient(args.ollama_host)
        print(json.dumps(client.tags(), ensure_ascii=False, indent=2))
        return

    store = KnowledgeStore(Path(args.db))
    client = OllamaClient(args.ollama_host)

    if args.command == "ingest":
        paths = [Path(path).resolve() for path in (args.paths or [str(DOCS_DIR)])]
        report = ingest(
            paths=paths,
            store=store,
            client=client,
            embed_model=args.embed_model,
            max_chars=args.max_chars,
            overlap=args.overlap,
            reset=args.reset,
        )
        print(f"Indexed {report.documents} document(s), {report.chunks} chunk(s).")
        if report.skipped:
            print("Skipped:")
            for item in report.skipped:
                print(f"- {item}")
        return

    if args.command == "ask":
        answer = ask(
            question=args.question,
            store=store,
            client=client,
            chat_model=args.chat_model,
            embed_model=args.embed_model,
            top_k=args.top_k,
        )
        print(answer.text)
        if answer.sources:
            print("\nSources:")
            for source in answer.sources:
                print(f"- {source.doc_name} chunk {source.chunk_index} score={source.score:.3f}")
        return

    if args.command == "stats":
        print(json.dumps(store.stats(), ensure_ascii=False, indent=2))
        return

    if args.command == "serve":
        run_server(
            host=args.host,
            port=args.port,
            store=store,
            client=client,
            chat_model=args.chat_model,
            embed_model=args.embed_model,
            top_k=args.top_k,
        )
        return

    parser.print_help()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Local private knowledge base powered by Ollama.")
    parser.add_argument("--ollama-host", default=DEFAULT_OLLAMA_HOST)
    parser.add_argument("--db", default=str(DB_PATH))

    subparsers = parser.add_subparsers(dest="command", required=True)

    check_parser = subparsers.add_parser("check", help="Check Ollama connectivity.")
    check_parser.add_argument("--ollama-host", default=DEFAULT_OLLAMA_HOST)

    ingest_parser = subparsers.add_parser("ingest", help="Index documents.")
    ingest_parser.add_argument("paths", nargs="*")
    ingest_parser.add_argument("--embed-model", default=DEFAULT_EMBED_MODEL)
    ingest_parser.add_argument("--max-chars", type=int, default=1200)
    ingest_parser.add_argument("--overlap", type=int, default=180)
    ingest_parser.add_argument("--reset", action="store_true")

    ask_parser = subparsers.add_parser("ask", help="Ask a question.")
    ask_parser.add_argument("question")
    ask_parser.add_argument("--chat-model", default=DEFAULT_CHAT_MODEL)
    ask_parser.add_argument("--embed-model", default=DEFAULT_EMBED_MODEL)
    ask_parser.add_argument("--top-k", type=int, default=DEFAULT_TOP_K)

    stats_parser = subparsers.add_parser("stats", help="Show index stats.")
    stats_parser.set_defaults(command="stats")

    serve_parser = subparsers.add_parser("serve", help="Start a local web UI.")
    serve_parser.add_argument("--host", default="127.0.0.1")
    serve_parser.add_argument("--port", type=int, default=8765)
    serve_parser.add_argument("--chat-model", default=DEFAULT_CHAT_MODEL)
    serve_parser.add_argument("--embed-model", default=DEFAULT_EMBED_MODEL)
    serve_parser.add_argument("--top-k", type=int, default=DEFAULT_TOP_K)

    return parser

