"""LLM client for Volle agent.

Supports any OpenAI-compatible API (OpenRouter, OpenAI, etc).
If no API key is configured, returns None so caller can fall back to mock.
"""

import os
import json
import httpx
from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------------------
# Provider configuration
# ---------------------------------------------------------------------------

_PROVIDER = os.getenv("LLM_PROVIDER", "openai").lower().strip()

_OPENAI_KEY = os.getenv("OPENAI_API_KEY")
_OPENAI_BASE = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
_OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o")

_LOCAL_BASE = os.getenv("LOCAL_LLM_BASE_URL", "http://localhost:11434/v1")
_LOCAL_MODEL = os.getenv("LOCAL_LLM_MODEL", "llama3")

BUSINESS_SYSTEM_PROMPT = (
    "Jesteś Volle, voice-native business agent dla właścicieli małych firm. "
    "Mówisz krótko, naturalnie, po polsku. Nie używasz żargonu technicznego. "
    "Twoim zadaniem jest analizować dane biznesowe i przedstawiać wnioski "
    "w formie przystępnej dla nie-technicznego użytkownika. "
    "Zawsze podawaj konkretne liczby. Odpowiadaj tak, jakbyś opowiadał to szefowi "
    "podczas krótkiego briefingu. Nie przepraszaj. Nie zaczynaj od 'Oto analiza...'. "
    "Zacznij od razu od sedna."
)


def _get_provider_config() -> tuple[str, str, str]:
    """Return (base_url, api_key, model) for active provider."""
    if _PROVIDER == "local":
        return _LOCAL_BASE, "ollama", _LOCAL_MODEL
    return _OPENAI_BASE, _OPENAI_KEY or "", _OPENAI_MODEL


async def _chat_complete(
    user_message: str,
    system_prompt: str | None = None,
    vision_image: str | None = None,
) -> str | None:
    base_url, api_key, model = _get_provider_config()

    sys_msg = system_prompt or BUSINESS_SYSTEM_PROMPT
    timeout = 120.0 if _PROVIDER == "local" else 30.0

    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    messages: list[dict] = [{"role": "system", "content": sys_msg}]

    if vision_image:
        messages.append({
            "role": "user",
            "content": [
                {"type": "text", "text": user_message},
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/png;base64,{vision_image}"},
                },
            ],
        })
    else:
        messages.append({"role": "user", "content": user_message})

    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            payload = {
                "model": model,
                "messages": messages,
                "temperature": 0.35,
                "max_tokens": 600,
            }
            # Some local servers (llama-cpp etc.) prefer stream=false explicitly
            payload["stream"] = False
            r = await client.post(
                f"{base_url}/chat/completions",
                headers=headers,
                json=payload,
            )
            r.raise_for_status()
            data = r.json()
            return data["choices"][0]["message"]["content"]
        except Exception as exc:
            print(f"[LLM] Error ({_PROVIDER}): {exc}")
            return None


async def chat(user_message: str, system_prompt: str | None = None) -> str | None:
    """Send a chat completion request. Returns None on missing key or error."""
    if _PROVIDER != "local" and not _OPENAI_KEY:
        return None
    return await _chat_complete(user_message, system_prompt)


async def chat_vision(base64_image: str, user_message: str, system_prompt: str | None = None) -> str | None:
    """Send a vision chat completion request with a base64-encoded PNG image."""
    if _PROVIDER != "local" and not _OPENAI_KEY:
        return None
    return await _chat_complete(user_message, system_prompt, vision_image=base64_image)


async def local_llm_status() -> dict:
    """Probe local LLM server (Ollama/lm-studio) for availability and model list."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(f"{_LOCAL_BASE}/models")
            r.raise_for_status()
            data = r.json()
            models = [m.get("id") for m in data.get("data", [])]
            return {
                "available": True,
                "models": models,
                "default_model": _LOCAL_MODEL,
                "url": _LOCAL_BASE,
            }
    except Exception as exc:
        return {"available": False, "error": str(exc), "url": _LOCAL_BASE}