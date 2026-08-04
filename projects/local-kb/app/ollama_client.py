from __future__ import annotations

import json
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any


@dataclass
class OllamaClient:
    host: str = "http://127.0.0.1:11434"

    def __post_init__(self) -> None:
        self.host = self.host.rstrip("/")

    def tags(self) -> dict[str, Any]:
        return self._get("/api/tags")

    def embed(self, model: str, text: str) -> list[float]:
        try:
            data = self._post("/api/embed", {"model": model, "input": text})
            embeddings = data.get("embeddings")
            if isinstance(embeddings, list) and embeddings:
                return [float(x) for x in embeddings[0]]
        except urllib.error.HTTPError as exc:
            if exc.code not in {404, 405}:
                raise

        data = self._post("/api/embeddings", {"model": model, "prompt": text})
        embedding = data.get("embedding")
        if not isinstance(embedding, list):
            raise RuntimeError(f"Ollama embedding response did not include an embedding for model {model!r}")
        return [float(x) for x in embedding]

    def chat(self, model: str, user_prompt: str, system_prompt: str | None = None) -> str:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": user_prompt})
        data = self._post("/api/chat", {"model": model, "messages": messages, "stream": False})
        message = data.get("message") or {}
        content = message.get("content")
        if isinstance(content, str):
            return content.strip()

        data = self._post("/api/generate", {"model": model, "prompt": user_prompt, "stream": False})
        response = data.get("response")
        if not isinstance(response, str):
            raise RuntimeError(f"Ollama chat response did not include content for model {model!r}")
        return response.strip()

    def _get(self, path: str) -> dict[str, Any]:
        with urllib.request.urlopen(self.host + path, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))

    def _post(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        request = urllib.request.Request(
            self.host + path,
            data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=600) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError:
            raise
        except urllib.error.URLError as exc:
            raise RuntimeError(f"Could not reach Ollama at {self.host}. Start Ollama first.") from exc
