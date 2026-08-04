from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass
class OCRLine:
    text: str
    confidence: float


@dataclass
class OCRResult:
    image_path: Path
    text: str
    lines: list[OCRLine]


class OCRUnavailable(RuntimeError):
    pass


def read_image_text(image_path: Path) -> OCRResult:
    try:
        from rapidocr_onnxruntime import RapidOCR  # type: ignore
    except ImportError as exc:
        raise OCRUnavailable(
            "OCR dependency is missing. Run: .\\.venv\\Scripts\\python.exe -m pip install -r requirements.txt"
        ) from exc

    engine = RapidOCR()
    result, _ = engine(str(image_path))
    lines: list[OCRLine] = []
    if result:
        for item in result:
            text = str(item[1]).strip()
            confidence = float(item[2])
            if text:
                lines.append(OCRLine(text=text, confidence=confidence))
    return OCRResult(
        image_path=image_path,
        text="\n".join(line.text for line in lines),
        lines=lines,
    )

