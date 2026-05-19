"""ElevenLabs Conversational AI integration for Volle.

Manages agent lifecycle, system prompts, tools, and voice settings via
ElevenLabs REST API.  Also provides helper to generate signed WebSocket
 URLs for client-side voice streaming.

Docs: https://elevenlabs.io/docs/conversational-ai/overview
"""

from __future__ import annotations

import os
import json
from typing import Any

import httpx

ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
BASE_URL = "https://api.elevenlabs.io/v1"

DEFAULT_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")

# ---------------------------------------------------------------------------
# System Prompts
# ---------------------------------------------------------------------------

BUSINESS_ANALYTICS_SYSTEM_PROMPT = """Jesteś Volle — voice-native business agent dla właścicieli małych i średnich firm e-commerce w Polsce.

ZASADY INTERAKCJI:
- Mówisz krótko, konkretnie, naturalnie po polsku. Maksymalnie 2-3 zdania na odpowiedź.
- Nigdy nie używasz żargonu technicznego. Wyjaśniasz jak szefowi podczas kawy.
- Zawsze podawaj konkretne liczby, procenty, kwoty w PLN.
- Nie przepraszasz. Nie zaczynasz od "Oto analiza..." — idziesz od razu do sedna.
- Jeśli nie masz danych — mówisz wprost: "Nie mam dostępu do tych danych. Sprawdź czy integracja jest włączona."
- Ton: bezpośredni, profesjonalny, ale przyjazny. Jak zaufany doradca.

CO POTRAFISZ (tools):
- get_sales_summary — podsumowanie sprzedaży za okres (dzień, tydzień, miesiąc)
- compare_periods — porównanie dwóch okresów z procentową zmianą
- get_top_products — najlepiej sprzedające się produkty
- get_revenue_trend — trend przychodów (wzrost/spadek)
- get_customer_metrics — LTV, retencja, powtarzalność zakupów
- check_inventory — stan magazynowy i alerty niskiego stanu

FORMAT ODPOWIEDZI:
- Zawsze zacznij od najważniejszej liczby.
- Dodaj kontekst: "To o 15% więcej niż w zeszłym tygodniu."
- Jeśli wynik jest zły, sugeruj jedno konkretne działanie.

PRZYKŁADY:
Użytkownik: "Jak wczoraj poszła sprzedaż?"
Volle: "Wczoraj 4 230 zł, 17 zamówień. To o 12% mniej niż środa, ale nadal dobry wynik na czwartek."

Użytkownik: "Porównaj ten tydzień z poprzednim."
Volle: "Ten tydzień: 31 800 zł. Poprzedni: 28 400 zł. Wzrost o 12%. Najwięcej wzrosła kategoria elektronika — plus 34%."

Użytkownik: "Który produkt najlepiej się sprzedaje?"
Volle: "Lider to Słuchawki Pro X — 89 sztuk w tym miesiącu. Przychód 26 700 zł. Drugie miejsce: Etui Premium — 156 sztuk, ale niższy przychód 7 800 zł."
"""

DESKTOP_AUTOMATION_SYSTEM_PROMPT = """Jesteś Volle — voice-native desktop agent. Pomagasz organizować pracę na komputerze.

ZASADY INTERAKCJI:
- Mówisz krótko i naturalnie po polsku.
- Potwierdzasz wykonanie akcji jednym zdaniem.
- Jeśli akcja jest ryzykowna (usuwanie plików, wysyłanie emaila), pytasz o potwierdzenie.
- Nie wyjaśniasz jak działa komputer. Traktujesz użytkownika jak szefa, nie jak ucznia.

DOSTĘPNE NARZĘDZIA (tools):
- desktop_organize — uporządkuj pliki na pulpicie/wybranym folderze
- open_app — otwórz aplikację
- take_screenshot — zrób zrzut ekranu i opisz co widzisz
- clipboard_action — kopiuj/wklej ze schowka
- type_text — wpisz tekst w aktywne pole
- send_email — napisz i wyślij email (zawsze potwierdzenie!)
- web_search — wyszukaj w internecie
- search_notes — przeszukaj notatki z pamięci

ZASADY BEZPIECZEŃSTWA:
- Zielone (auto): otwórz aplikację, zrzut ekranu, wyszukaj, przeczytaj notatkę
- Żółte (potwierdzenie głosowe): uporządkuj pliki, kopiuj/wklej, wpisz tekst
- Pomarańczowe (potwierdzenie wizualne + głosowe): odczytaj dane finansowe
- Czerwone (PIN lub hasło): wyślij email, usuń pliki, modyfikuj integracje

PRZYKŁADY:
Użytkownik: "Uporządkuj mi pulpit."
Volle: "Rozumiem. Przenoszę pliki do folderów Dokumenty, Obrazy i Inne. Potwierdź: tak?"

Użytkownik: "Napisz email do Kowalskiego."
Volle: "Czy mogę wiedzieć o czym ten email? I czy to na adres jan.kowalski@firma.pl?"

Użytkownik: "Co widzisz na ekranie?"
Volle: "Widzę okno Excela z tabelą sprzedaży. Kolumny: data, produkt, ilość, przychód. Ostatni wiersz to dzisiaj — 5 400 zł."
"""

GENERAL_PURPOSE_SYSTEM_PROMPT = """Jesteś Volle — voice-native AI agent dla właścicieli firm. Łączysz analizę biznesową z automatyzacją desktopu.

TOŻSAMOŚĆ:
- Imię: Volle (jak "wolność" bez L, ale nie tłumacz tego użytkownikowi)
- Język: polski
- Ton: bezpośredni, konkretny, jak zaufany doradca. Nie chatbotowy.
- Długość odpowiedzi: max 2-3 zdania. Użytkownik jest zajęty.

DYSCYPLINY:
1. BIZNES ANALITYKA: sprzedaż, przychód, trendy, produkty, klienci
2. DESKTOP AUTOMATION: pliki, aplikacje, email, schowek, zrzuty ekranu
3. KNOWLEDGE: notatki, research, kalendarz, zadania

ZASADY:
- Zawsze najpierw liczby, potem kontekst.
- Jeśli użytkownik mówi "sprawdź", "porównaj", "pokaż" — zakładasz biznes.
- Jeśli użytkownik mówi "uporządkuj", "otwórz", "wpisz" — zakładasz desktop.
- Jeśli nie jesteś pewna intencji — pytasz krótko: "Chodzi o dane czy o plik?"
- Nigdy nie wymyślasz danych. Nigdy nie zgadujesz liczb.
- Jeśli nie masz dostępu do danych — mówisz: "Potrzebuję połączenia z [nazwa integracji]. Skonfiguruj w ustawieniach."

NARZĘDZIA (używaj gdy potrzebne):
- get_sales_summary, compare_periods, get_top_products, get_revenue_trend
- desktop_organize, open_app, take_screenshot, clipboard_action, type_text
- send_email, web_search, search_notes, read_note, write_note
- get_customer_metrics, check_inventory

PRZYKŁAD:
Użytkownik: "Jak wczoraj?"
Volle: "Wczoraj 4 230 zł, 17 zamówień. To o 12% mniej niż w środę."

Użytkownik: "Uporządkuj mi pliki z Pobranych."
Volle: "Rozumiem. Sortuję pliki z Pobranych według typu. Potwierdź: tak?"
"""

# ---------------------------------------------------------------------------
# Tool schemas for ElevenLabs
# ---------------------------------------------------------------------------

ELEVENLABS_TOOLS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "get_sales_summary",
            "description": "Pobierz podsumowanie sprzedaży za podany okres.",
            "parameters": {
                "type": "object",
                "properties": {
                    "period": {"type": "string", "enum": ["today", "yesterday", "week", "month", "quarter"]},
                    "metric": {"type": "string", "enum": ["revenue", "orders", "aov"], "default": "revenue"},
                },
                "required": ["period"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "compare_periods",
            "description": "Porównaj dwa okresy i zwróć procentową zmianę.",
            "parameters": {
                "type": "object",
                "properties": {
                    "current": {"type": "string", "description": "Obecny okres, np. 'this_week'"},
                    "previous": {"type": "string", "description": "Poprzedni okres, np. 'last_week'"},
                    "metric": {"type": "string", "enum": ["revenue", "orders", "aov"], "default": "revenue"},
                },
                "required": ["current", "previous"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_top_products",
            "description": "Zwróć najlepiej sprzedające się produkty.",
            "parameters": {
                "type": "object",
                "properties": {
                    "period": {"type": "string", "enum": ["week", "month", "quarter"], "default": "month"},
                    "limit": {"type": "integer", "default": 5},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "desktop_organize",
            "description": "Uporządkuj pliki w podanym folderze.",
            "parameters": {
                "type": "object",
                "properties": {
                    "folder": {"type": "string", "description": "Ścieżka do folderu, domyślnie pulpit użytkownika"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "take_screenshot",
            "description": "Zrób zrzut ekranu i opisz co widzisz.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "open_app",
            "description": "Otwórz aplikację na komputerze.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Nazwa aplikacji, np. Excel, Chrome, Outlook"},
                },
                "required": ["name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "send_email",
            "description": "Napisz i wyślij email. ZAWSZE potwierdź z użytkownikiem przed wysłaniem.",
            "parameters": {
                "type": "object",
                "properties": {
                    "to": {"type": "string"},
                    "subject": {"type": "string"},
                    "body": {"type": "string"},
                    "confirmed": {"type": "boolean", "description": "Czy użytkownik potwierdził wysyłkę"},
                },
                "required": ["to", "subject", "body", "confirmed"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "web_search",
            "description": "Wyszukaj w internecie.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                    "limit": {"type": "integer", "default": 3},
                },
                "required": ["query"],
            },
        },
    },
]

# ---------------------------------------------------------------------------
# Client
# ---------------------------------------------------------------------------

class ElevenLabsAgentClient:
    """Client for ElevenLabs Conversational AI REST API."""

    def __init__(self, api_key: str | None = None) -> None:
        self.api_key = api_key or ELEVENLABS_API_KEY
        self.headers = {
            "xi-api-key": self.api_key,
            "Content-Type": "application/json",
        }

    async def list_agents(self) -> list[dict]:
        async with httpx.AsyncClient() as client:
            r = await client.get(f"{BASE_URL}/convai/agents", headers=self.headers)
            r.raise_for_status()
            return r.json().get("agents", [])

    async def create_agent(
        self,
        name: str,
        system_prompt: str,
        tools: list[dict] | None = None,
        voice_id: str = DEFAULT_VOICE_ID,
        language: str = "pl",
    ) -> dict:
        """Create a new Conversational AI agent."""
        payload: dict[str, Any] = {
            "name": name,
            "conversation_config": {
                "agent": {
                    "prompt": system_prompt,
                    "language": language,
                },
                "tts": {
                    "voice_id": voice_id,
                },
            },
        }
        if tools:
            payload["conversation_config"]["agent"]["tools"] = tools

        async with httpx.AsyncClient() as client:
            r = await client.post(f"{BASE_URL}/convai/agents", headers=self.headers, json=payload)
            r.raise_for_status()
            return r.json()

    async def update_agent(
        self,
        agent_id: str,
        system_prompt: str | None = None,
        tools: list[dict] | None = None,
        voice_id: str | None = None,
    ) -> dict:
        """Patch an existing agent.  ElevenLabs uses PUT semantics for full replacement."""
        payload: dict[str, Any] = {}
        if system_prompt is not None:
            payload.setdefault("conversation_config", {}).setdefault("agent", {})["prompt"] = system_prompt
        if tools is not None:
            payload.setdefault("conversation_config", {}).setdefault("agent", {})["tools"] = tools
        if voice_id is not None:
            payload.setdefault("conversation_config", {})["tts"] = {"voice_id": voice_id}

        async with httpx.AsyncClient() as client:
            r = await client.patch(
                f"{BASE_URL}/convai/agents/{agent_id}",
                headers=self.headers,
                json=payload,
            )
            r.raise_for_status()
            return r.json()

    async def get_agent(self, agent_id: str) -> dict:
        async with httpx.AsyncClient() as client:
            r = await client.get(f"{BASE_URL}/convai/agents/{agent_id}", headers=self.headers)
            r.raise_for_status()
            return r.json()

    async def delete_agent(self, agent_id: str) -> None:
        async with httpx.AsyncClient() as client:
            r = await client.delete(f"{BASE_URL}/convai/agents/{agent_id}", headers=self.headers)
            r.raise_for_status()

    async def create_signed_url(self, agent_id: str) -> str:
        """Generate a short-lived signed WebSocket URL for client-side voice streaming.

        The frontend opens a WebSocket to this URL and speaks directly with the
        ElevenLabs agent.  This avoids exposing the API key in the client.
        """
        async with httpx.AsyncClient() as client:
            r = await client.post(
                f"{BASE_URL}/convai/conversation/get_signed_url",
                headers=self.headers,
                params={"agent_id": agent_id},
            )
            r.raise_for_status()
            data = r.json()
            return data["signed_url"]


# ---------------------------------------------------------------------------
# Volle-specific helpers
# ---------------------------------------------------------------------------

async def ensure_volle_agents() -> dict[str, str]:
    """Idempotently create/update the three Volle agent personas on ElevenLabs.

    Returns a mapping: {"business": agent_id, "desktop": agent_id, "general": agent_id}
    """
    if not ELEVENLABS_API_KEY:
        raise RuntimeError("ELEVENLABS_API_KEY is not configured")

    client = ElevenLabsAgentClient()
    existing = {a["name"]: a["agent_id"] for a in await client.list_agents()}
    ids: dict[str, str] = {}

    configs = [
        ("Volle Business", BUSINESS_ANALYTICS_SYSTEM_PROMPT, [
            t for t in ELEVENLABS_TOOLS if t["function"]["name"] in {
                "get_sales_summary", "compare_periods", "get_top_products",
                "get_revenue_trend", "web_search",
            }
        ]),
        ("Volle Desktop", DESKTOP_AUTOMATION_SYSTEM_PROMPT, [
            t for t in ELEVENLABS_TOOLS if t["function"]["name"] in {
                "desktop_organize", "open_app", "take_screenshot",
                "send_email", "web_search",
            }
        ]),
        ("Volle General", GENERAL_PURPOSE_SYSTEM_PROMPT, ELEVENLABS_TOOLS),
    ]

    for name, prompt, tools in configs:
        if name in existing:
            await client.update_agent(existing[name], system_prompt=prompt, tools=tools)
            ids[name.lower().replace("volle ", "")] = existing[name]
        else:
            created = await client.create_agent(name=name, system_prompt=prompt, tools=tools)
            ids[name.lower().replace("volle ", "")] = created["agent_id"]

    return ids


def build_system_prompt(mode: str = "general") -> str:
    """Return the appropriate system prompt string for the given mode.

    Modes:
        business  — focused on sales / revenue analytics
        desktop   — focused on file / app / automation tasks
        general   — hybrid (default)
    """
    return {
        "business": BUSINESS_ANALYTICS_SYSTEM_PROMPT,
        "desktop": DESKTOP_AUTOMATION_SYSTEM_PROMPT,
        "general": GENERAL_PURPOSE_SYSTEM_PROMPT,
    }.get(mode, GENERAL_PURPOSE_SYSTEM_PROMPT)
