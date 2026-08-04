from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any


@dataclass
class OllamaClient:
    host: str
    model: str

    def chat(self, prompt: str, system: str | None = None) -> str:
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        payload = {"model": self.model, "messages": messages, "stream": False}
        data = post_json(self.host.rstrip("/") + "/api/chat", payload)
        message = data.get("message") or {}
        content = message.get("content")
        if isinstance(content, str):
            return content.strip()
        raise RuntimeError("Ollama response did not include message content.")


@dataclass
class DeepSeekClient:
    base_url: str
    model: str
    api_key: str | None = None

    def chat(self, prompt: str, system: str | None = None) -> str:
        key = self.api_key or os.getenv("DEEPSEEK_API_KEY")
        if not key:
            raise RuntimeError("DEEPSEEK_API_KEY is not set.")
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        payload = {"model": self.model, "messages": messages, "stream": False}
        data = post_json(
            self.base_url.rstrip("/") + "/chat/completions",
            payload,
            headers={"Authorization": f"Bearer {key}"},
        )
        choices = data.get("choices") or []
        if choices:
            content = choices[0].get("message", {}).get("content")
            if isinstance(content, str):
                return content.strip()
        raise RuntimeError("DeepSeek response did not include message content.")


def post_json(url: str, payload: dict[str, Any], headers: dict[str, str] | None = None) -> dict[str, Any]:
    request_headers = {"Content-Type": "application/json"}
    if headers:
        request_headers.update(headers)
    request = urllib.request.Request(
        url,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers=request_headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Request failed: {url}") from exc

