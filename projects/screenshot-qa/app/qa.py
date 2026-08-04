from __future__ import annotations

import datetime as dt
import json
from dataclasses import asdict, dataclass
from pathlib import Path

from .config import HISTORY_DIR
from .llm import DeepSeekClient, OllamaClient
from .ocr import OCRResult, read_image_text


SYSTEM_PROMPT = """你是截图问答助手。你看不到原始图片，只能依据 OCR 提取的文字回答。
如果 OCR 内容不足，请明确说明不确定，并给出下一步建议。"""


@dataclass
class QAResult:
    image_path: str
    question: str
    ocr_text: str
    answer: str
    provider: str
    model: str


def answer_image(
    image_path: Path,
    question: str,
    provider: str,
    ollama_host: str,
    ollama_model: str,
    deepseek_base_url: str,
    deepseek_model: str,
) -> QAResult:
    ocr_result = read_image_text(image_path)
    prompt = build_prompt(question, ocr_result)

    if provider == "ollama":
        client = OllamaClient(host=ollama_host, model=ollama_model)
        answer = client.chat(prompt, system=SYSTEM_PROMPT)
        model = ollama_model
    elif provider == "deepseek":
        client = DeepSeekClient(base_url=deepseek_base_url, model=deepseek_model)
        answer = client.chat(prompt, system=SYSTEM_PROMPT)
        model = deepseek_model
    else:
        raise ValueError(f"Unsupported provider: {provider}")

    result = QAResult(
        image_path=str(image_path),
        question=question,
        ocr_text=ocr_result.text,
        answer=answer,
        provider=provider,
        model=model,
    )
    save_history(result)
    return result


def build_prompt(question: str, ocr_result: OCRResult) -> str:
    text = ocr_result.text.strip() or "(OCR 没有识别出文字)"
    return f"""用户问题：
{question}

截图 OCR 结果：
{text}

请根据 OCR 结果回答。若是报错或界面问题，请给出原因判断和可执行步骤。"""


def save_history(result: QAResult) -> Path:
    HISTORY_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    path = HISTORY_DIR / f"qa-{timestamp}.json"
    path.write_text(json.dumps(asdict(result), ensure_ascii=False, indent=2), encoding="utf-8")
    return path

