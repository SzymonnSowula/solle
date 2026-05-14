"""LLM client for Volle agent.

Supports any OpenAI-compatible API (OpenRouter, OpenAI, etc).
If no API key is configured, returns None so caller can fall back to mock.
"""

import os
import json
import httpx
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("OPENAI_API_KEY")
BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
MODEL = os.getenv("OPENAI_MODEL", "gpt-4o")

BUSINESS_SYSTEM_PROMPT = (
    "Jesteś Volle, voice-native business agent dla właścicieli małych firm. "
    "Mówisz krótko, naturalnie, po polsku. Nie używasz żargonu technicznego. "
    "Twoim zadaniem jest analizować dane biznesowe i przedstawiać wnioski "
    "w formie przystępnej dla nie-technicznego użytkownika. "
    "Zawsze podawaj konkretne liczby. Odpowiadaj tak, jakbyś opowiadał to szefowi "
    "podczas krótkiego briefingu. Nie przepraszaj. Nie zaczynaj od 'Oto analiza...'. "
    "Zacznij od razu od sedna."
)


async def chat(user_message: str, system_prompt: str | None = None) -> str | None:
    """Send a chat completion request. Returns None on missing key or error."""
    if not API_KEY:
        return None

    sys_msg = system_prompt or BUSINESS_SYSTEM_PROMPT

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            payload = {
                "model": MODEL,
                "messages": [
                    {"role": "system", "content": sys_msg},
                    {"role": "user", "content": user_message},
                ],
                "temperature": 0.35,
                "max_tokens": 600,
            }
            r = await client.post(
                f"{BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {API_KEY}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            r.raise_for_status()
            data = r.json()
            return data["choices"][0]["message"]["content"]
        except Exception as exc:
            # Log but do not crash – caller will fall back to mock
            print(f"[LLM] Error: {exc}")
            return None
