from __future__ import annotations

import argparse
from pathlib import Path

from .capture import capture_screen
from .config import (
    DEFAULT_DEEPSEEK_BASE_URL,
    DEFAULT_DEEPSEEK_MODEL,
    DEFAULT_OLLAMA_HOST,
    DEFAULT_OLLAMA_MODEL,
    ensure_dirs,
)
from .ocr import read_image_text
from .qa import answer_image


def main(argv: list[str] | None = None) -> None:
    ensure_dirs()
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.command == "capture":
        path = capture_screen(Path(args.output).resolve() if args.output else None)
        print(path)
        return

    if args.command == "ocr":
        result = read_image_text(Path(args.image).resolve())
        print(result.text)
        return

    if args.command == "ask":
        image_path = resolve_image(args)
        result = answer_image(
            image_path=image_path,
            question=args.question,
            provider=args.provider,
            ollama_host=args.ollama_host,
            ollama_model=args.ollama_model,
            deepseek_base_url=args.deepseek_base_url,
            deepseek_model=args.deepseek_model,
        )
        print("OCR:")
        print(result.ocr_text or "(empty)")
        print("\nAnswer:")
        print(result.answer)
        return

    parser.print_help()


def resolve_image(args: argparse.Namespace) -> Path:
    if args.capture:
        return capture_screen()
    if args.image:
        return Path(args.image).resolve()
    raise SystemExit("Provide --image PATH or use --capture.")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Screenshot OCR QA helper.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    capture_parser = subparsers.add_parser("capture", help="Capture the current screen.")
    capture_parser.add_argument("--output")

    ocr_parser = subparsers.add_parser("ocr", help="Extract text from an image.")
    ocr_parser.add_argument("--image", required=True)

    ask_parser = subparsers.add_parser("ask", help="Ask a question about a screenshot.")
    ask_parser.add_argument("question")
    ask_parser.add_argument("--image")
    ask_parser.add_argument("--capture", action="store_true")
    ask_parser.add_argument("--provider", choices=["ollama", "deepseek"], default="ollama")
    ask_parser.add_argument("--ollama-host", default=DEFAULT_OLLAMA_HOST)
    ask_parser.add_argument("--ollama-model", default=DEFAULT_OLLAMA_MODEL)
    ask_parser.add_argument("--deepseek-base-url", default=DEFAULT_DEEPSEEK_BASE_URL)
    ask_parser.add_argument("--deepseek-model", default=DEFAULT_DEEPSEEK_MODEL)

    return parser

