import os
import time
import json
import logging
import urllib.request
import urllib.error
from abc import ABC, abstractmethod
from typing import Generator, Optional, Dict, Any, List

logger = logging.getLogger("life.llm_providers")

class BaseLLMProvider(ABC):
    @abstractmethod
    def is_available(self) -> bool:
        pass

    @abstractmethod
    def generate(self, prompt: str, system_prompt: Optional[str] = None, **kwargs) -> str:
        pass

    @abstractmethod
    def generate_stream(self, prompt: str, system_prompt: Optional[str] = None, **kwargs) -> Generator[str, None, None]:
        pass

class OllamaProvider(BaseLLMProvider):
    """
    Optional Local Ollama LLM Provider (e.g. llama3.2, mistral, qwen2.5-coder).
    100% resilient: has a 1.5s circuit breaker and never crashes the app if offline.
    """
    def __init__(self, host: Optional[str] = None, model: str = "llama3.2"):
        self.host = (host or os.environ.get("OLLAMA_HOST") or "http://localhost:11434").rstrip("/")
        self.model = os.environ.get("OLLAMA_MODEL") or model
        self._last_health_check = 0.0
        self._is_healthy = False

    def is_available(self) -> bool:
        # Cache health check for 60 seconds to avoid ping latency on every call
        now = time.time()
        if now - self._last_health_check < 60.0:
            return self._is_healthy

        self._last_health_check = now
        try:
            req = urllib.request.Request(f"{self.host}/api/tags", headers={"User-Agent": "Life-AI"})
            with urllib.request.urlopen(req, timeout=1.2) as response:
                if response.status == 200:
                    self._is_healthy = True
                    return True
        except Exception:
            self._is_healthy = False

        return False

    def generate(self, prompt: str, system_prompt: Optional[str] = None, **kwargs) -> str:
        url = f"{self.host}/api/generate"
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False
        }
        if system_prompt:
            payload["system"] = system_prompt

        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=15.0) as resp:
            res_json = json.loads(resp.read().decode("utf-8"))
            return res_json.get("response", "").strip()

    def generate_stream(self, prompt: str, system_prompt: Optional[str] = None, **kwargs) -> Generator[str, None, None]:
        url = f"{self.host}/api/generate"
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": True
        }
        if system_prompt:
            payload["system"] = system_prompt

        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=30.0) as resp:
            for line in resp:
                if line:
                    chunk = json.loads(line.decode("utf-8"))
                    text_piece = chunk.get("response", "")
                    if text_piece:
                        yield text_piece
                    if chunk.get("done", False):
                        break

class GeminiProvider(BaseLLMProvider):
    """
    Cloud Google Gemini Provider with automatic quota fallback and streaming support.
    """
    def __init__(self, model_name: str = "gemini-flash-lite-latest"):
        self.model_name = model_name

    def is_available(self) -> bool:
        from app.services.llm_service import get_gemini_client
        return get_gemini_client() is not None

    def generate(self, prompt: str, system_prompt: Optional[str] = None, **kwargs) -> str:
        from app.services.llm_service import get_gemini_client, CANDIDATE_MODELS
        client = get_gemini_client()
        if not client:
            raise RuntimeError("Gemini API key is not configured.")

        models_to_try = [self.model_name] + [m for m in CANDIDATE_MODELS if m != self.model_name]
        last_err = None

        full_prompt = f"System: {system_prompt}\n\nUser: {prompt}" if system_prompt else prompt

        for m_name in models_to_try:
            try:
                model = client.GenerativeModel(m_name)
                response = model.generate_content(full_prompt)
                if response and response.text:
                    return response.text.strip()
            except Exception as e:
                last_err = e
                logger.warning(f"GeminiProvider ({m_name}) error: {e}")
                continue

        raise RuntimeError(f"All Gemini models failed: {last_err}")

    def generate_stream(self, prompt: str, system_prompt: Optional[str] = None, **kwargs) -> Generator[str, None, None]:
        from app.services.llm_service import get_gemini_client, CANDIDATE_MODELS
        client = get_gemini_client()
        if not client:
            yield "Gemini API key is not configured."
            return

        models_to_try = [self.model_name] + [m for m in CANDIDATE_MODELS if m != self.model_name]
        full_prompt = f"System: {system_prompt}\n\nUser: {prompt}" if system_prompt else prompt

        for m_name in models_to_try:
            try:
                model = client.GenerativeModel(m_name)
                response = model.generate_content(full_prompt, stream=True)
                for chunk in response:
                    if chunk.text:
                        yield chunk.text
                return
            except Exception as e:
                logger.warning(f"GeminiProvider stream ({m_name}) error: {e}")
                continue

        yield "Failed to generate streaming response from AI service."

class ModelRouter:
    """
    Intelligent Model Selection & Provider Fallback Manager:
    Routes between:
    - FAST / SMALL (Ollama local if available or Gemini Flash Lite)
    - MEDIUM (Ollama / Gemini Flash)
    - HARD (Gemini Flash Preview / Pro)
    """
    def __init__(self):
        self.ollama = OllamaProvider()
        self.gemini = GeminiProvider()

    def get_provider(self, tier: str = "fast") -> BaseLLMProvider:
        # Check if Ollama is requested or preferred in environment
        use_ollama = os.environ.get("USE_OLLAMA", "").lower() in ["1", "true", "yes"]
        if (use_ollama or tier == "medium") and self.ollama.is_available():
            return self.ollama

        # Default to high-speed Gemini
        return self.gemini

model_router = ModelRouter()
