"""LangGraph conversation orchestrator for Volle agent.

Implements a state machine:
    idle -> understanding -> tool_calling -> responding -> follow_up
with conditional routing between understanding and (tool_calling | responding).
"""

from __future__ import annotations

import json
from datetime import date, timedelta
from typing import Any, TypedDict

from . import llm
from . import mcp_client
from db.repository import UserRepo, SessionRepo, SettingsRepo, ActionLogRepo


class GraphState(TypedDict):
    """Shared state carried across graph nodes."""

    messages: list[dict[str, Any]]
    current_intent: str
    tool_calls: list[dict[str, Any]]
    tool_results: list[Any]
    response_text: str
    visual_card: dict[str, Any] | None
    memory_context: str
    user_id: int
    session_id: str


# ---------------------------------------------------------------------------
# Date helpers
# ---------------------------------------------------------------------------

def _yesterday() -> date:
    return date.today() - timedelta(days=1)


def _month_start(d: date) -> date:
    return d.replace(day=1)


def _week_start(d: date) -> date:
    return d - timedelta(days=6)


# ---------------------------------------------------------------------------
# State helpers
# ---------------------------------------------------------------------------

def _last_user_message(state: GraphState) -> str:
    """Extract the most recent user message content."""
    for msg in reversed(state["messages"]):
        if msg.get("role") == "user":
            return msg.get("content", "")
    return ""


def _strip_code_fences(text: str) -> str:
    """Remove markdown code fences if LLM wrapped JSON in them."""
    stripped = text.strip()
    if stripped.startswith("```"):
        lines = stripped.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        stripped = "\n".join(lines).strip()
    return stripped


# ---------------------------------------------------------------------------
# Memory
# ---------------------------------------------------------------------------

async def _load_memory(user_id: int) -> str:
    """Load user profile from DB and settings kv."""
    user = await UserRepo().get_or_create()
    settings = SettingsRepo()
    tasks_raw = await settings.get(user_id, "tasks")
    folders_raw = await settings.get(user_id, "important_folders")
    tasks = json.loads(tasks_raw) if tasks_raw else ["emaile", "pliki", "research", "kalendarz"]
    folders = json.loads(folders_raw) if folders_raw else ["Pulpit", "Dokumenty", "Pobrane"]
    name = user.get("user_name") or "Szef"
    tone = user.get("preferred_tone") or "Bezpośredni, konkretny"
    return (
        f"Użytkownik: {name}. "
        f"Preferowany ton: {tone}. "
        f"Częste zadania: {', '.join(tasks)}. "
        f"Ważne foldery: {', '.join(folders)}."
    )


async def understand(state: GraphState) -> GraphState:
    """Call LLM to extract intent, tool needs and optional direct response.

    The LLM must return a JSON object with keys:
        intent, needs_tool, tool_name, tool_args, direct_response.
    If JSON parsing fails or LLM is unavailable, fall back to deterministic routing.
    """
    user_msg = _last_user_message(state)
    memory = state.get("memory_context", "")

    system_prompt = (
        "Jesteś Volle, voice-native desktop agent. "
        "Analizuj intencję użytkownika i zwróć WYŁĄCZNIE obiekt JSON w formacie:\n"
        '{\n'
        '  "intent": "nazwa_intencji",\n'
        '  "needs_tool": true/false,\n'
        '  "tool_name": "nazwa_narzędzia_lub_null",\n'
        '  "tool_args": {} lub null,\n'
        '  "direct_response": "krótka odpowiedź bezpośrednia lub null"\n'
        '}\n\n'
        "Dostępne narzędzia: web_search, desktop_organize, send_email, open_app, take_screenshot, clipboard_action, type_text, get_sales_summary, compare_periods, search_notes, read_note, write_note, list_notes. "
        "Dostępne intencje: direct, research, sales_summary, compare, organize, email, open, screenshot, vision, clipboard, type, memory_read, memory_write. "
        "Intent vision używaj gdy użytkownik pyta 'co widzisz na ekranie' – wtedy ustaw needs_tool=true, tool_name=take_screenshot. "
        "Jeśli potrzebujesz narzędzia – ustaw needs_tool=true i podaj tool_name oraz tool_args. "
        "Jeśli nie – ustaw needs_tool=false i podaj direct_response. "
        "Nie zwracaj nic poza JSON."
    )

    user_prompt = f"{memory}\n\nUżytkownik: {user_msg}"
    raw = await llm.chat(user_prompt, system_prompt=system_prompt)

    if raw is None:
        # LLM unavailable – fall back to keyword-based intent routing
        return _fallback_understand(user_msg, state)

    cleaned = _strip_code_fences(raw)
    try:
        parsed = json.loads(cleaned)
    except Exception:
        # JSON parsing failed – deterministic fallback
        return _fallback_understand(user_msg, state)

    intent = parsed.get("intent", "unknown")
    needs_tool = parsed.get("needs_tool", False)
    tool_name = parsed.get("tool_name")
    tool_args = parsed.get("tool_args")
    direct_response = parsed.get("direct_response", "")

    tool_calls: list[dict[str, Any]] = []
    if needs_tool and isinstance(tool_name, str):
        tool_calls.append({"name": tool_name, "args": tool_args if isinstance(tool_args, dict) else {}})

    return {
        **state,
        "current_intent": intent,
        "tool_calls": tool_calls,
        "response_text": direct_response,
    }


def _fallback_understand(user_msg: str, state: GraphState) -> GraphState:
    """Deterministic keyword-based intent routing when LLM is unavailable."""
    text = user_msg.lower()

    sales_kw = {"sprzedaż", "sprzedaz", "zamówienia", "zamowienia", "przychód", "przychod", "obroty", "podsumowanie"}
    time_kw = {"wczoraj", "miesiąc", "miesiac", "tydzień", "tydzien"}
    compare_kw = {"porównaj", "porownaj", "compare"}
    search_kw = {"wyszukaj", "search", "znajdź", "znajdz", "internet"}

    organize_kw = {"uporządkuj", "posprzątaj", "organizuj", "clean", "sortuj", "pliki", "folder", "pulpit", "desktop"}
    email_kw = {"email", "mail", "napisz", "wyślij", "wyslij", "wiadomość", "wiadomosc", "list"}
    open_kw = {"otwórz", "otworz", "uruchom", "open", "start", "aplikacja", "program"}
    screenshot_kw = {"zrzut", "screenshot", "ekran", "fotka", "zdjęcie", "zdjecie"}
    clipboard_kw = {"schowek", "clipboard", "kopiuj", "wklej", "wyciągnij"}
    type_kw = {"wpisz", "pisz", "type", "tekst", "wprowadź", "wprowadz"}

    vision_modifier_kw = {"widzisz", "widzieć", "widać", "opisz", "pokaż", "pokaz", "jak wygląda", "jak wyglada", "co jest", "co masz"}
    has_vision = any(k in text for k in screenshot_kw) and any(k in text for k in vision_modifier_kw)
    has_sales = any(k in text for k in sales_kw)
    has_time = any(k in text for k in time_kw)
    has_compare = any(k in text for k in compare_kw)
    has_search = any(k in text for k in search_kw)

    has_organize = any(k in text for k in organize_kw)
    has_email = any(k in text for k in email_kw)
    has_open = any(k in text for k in open_kw)
    has_screenshot = any(k in text for k in screenshot_kw)
    has_clipboard = any(k in text for k in clipboard_kw)
    has_type = any(k in text for k in type_kw)

    y = _yesterday()
    m_start = _month_start(y)
    w_start = _week_start(y)

    if has_vision:
        return {
            **state,
            "current_intent": "vision",
            "tool_calls": [{"name": "take_screenshot", "args": {}}],
            "response_text": "",
        }

    if has_organize:
        return {
            **state,
            "current_intent": "organize",
            "tool_calls": [{"name": "desktop_organize", "args": {"query": user_msg}}],
            "response_text": "",
        }

    if has_email:
        return {
            **state,
            "current_intent": "email",
            "tool_calls": [{"name": "send_email", "args": {"query": user_msg}}],
            "response_text": "",
        }

    if has_open:
        return {
            **state,
            "current_intent": "open",
            "tool_calls": [{"name": "open_app", "args": {"query": user_msg}}],
            "response_text": "",
        }

    if has_screenshot:
        return {
            **state,
            "current_intent": "screenshot",
            "tool_calls": [{"name": "take_screenshot", "args": {}}],
            "response_text": "",
        }

    if has_clipboard:
        return {
            **state,
            "current_intent": "clipboard",
            "tool_calls": [{"name": "clipboard_action", "args": {"query": user_msg}}],
            "response_text": "",
        }

    if has_type:
        return {
            **state,
            "current_intent": "type",
            "tool_calls": [{"name": "type_text", "args": {"query": user_msg}}],
            "response_text": "",
        }

    if has_sales and has_time:
        if "wczoraj" in text:
            date_from = str(y)
            date_to = str(y)
        elif "miesiąc" in text or "miesiac" in text:
            date_from = str(m_start)
            date_to = str(y)
        elif "tydzień" in text or "tydzien" in text:
            date_from = str(w_start)
            date_to = str(y)
        else:
            date_from = str(y)
            date_to = str(y)
        return {
            **state,
            "current_intent": "sales_summary",
            "tool_calls": [
                {"name": "get_sales_summary", "args": {"date_from": date_from, "date_to": date_to}}
            ],
            "response_text": "",
        }

    if has_compare:
        return {
            **state,
            "current_intent": "compare",
            "tool_calls": [
                {
                    "name": "compare_periods",
                    "args": {
                        "period_a_start": str(y),
                        "period_a_end": str(y),
                        "period_b_start": str(m_start),
                        "period_b_end": str(y),
                    },
                }
            ],
            "response_text": "",
        }

    if has_search:
        return {
            **state,
            "current_intent": "research",
            "tool_calls": [{"name": "web_search", "args": {"query": user_msg}}],
            "response_text": "",
        }

    return {
        **state,
        "current_intent": "direct",
        "tool_calls": [],
        "response_text": (
            "Niestety nie mam teraz połączenia z modelem językowym, "
            "więc nie mogę dokładnie przeanalizować Twojego pytania. "
            "Spróbuj zapytać o pliki, email, aplikację lub sprzedaż."
        ),
    }


def route(state: GraphState) -> str:
    """Conditional edge from understand -> tool_calling | responding."""
    if state.get("tool_calls"):
        return "tool_calling"
    return "responding"


async def call_tools(state: GraphState) -> GraphState:
    """Iterate tool_calls and invoke each via the MCP client."""
    results: list[Any] = []
    session_id = state.get("session_id")
    for call in state.get("tool_calls", []):
        name = call.get("name")
        args = call.get("args", {})
        if not name:
            continue
        try:
            result = await mcp_client.call_tool(name, args)
            parsed = None
            try:
                parsed = json.loads(result)
                results.append(parsed)
            except Exception:
                results.append(result)
            # Log undoable actions
            undo_data = None
            if isinstance(parsed, dict) and "undo_data" in parsed:
                undo_data = parsed["undo_data"]
            if name in ("organize_desktop", "move_files", "sort_files_by_date"):
                await ActionLogRepo().log(
                    session_id=session_id,
                    tool_name=name,
                    args=args,
                    result=parsed if isinstance(parsed, dict) else {"result": str(result)},
                    undo_data=undo_data,
                    undoable=bool(undo_data),
                )
        except Exception as exc:
            results.append({"error": str(exc), "tool": name})
            await ActionLogRepo().log(
                session_id=session_id,
                tool_name=name,
                args=args,
                result={"error": str(exc)},
                status="failed",
            )
    return {**state, "tool_results": results}


async def generate_response(state: GraphState) -> GraphState:
    """Build prompt with tool_results (if any) and ask LLM for a final Polish voice response."""
    user_msg = _last_user_message(state)
    memory = state.get("memory_context", "")
    intent = state.get("current_intent", "unknown")
    tool_results = state.get("tool_results", [])
    draft = state.get("response_text", "")

    if intent == "vision":
        for result in tool_results:
            if isinstance(result, dict) and "image_base64" in result:
                b64 = result["image_base64"]
                description = await llm.chat_vision(
                    b64,
                    "Opisz co widzisz na tym zrzucie ekranu. Bądź zwięzły, konkretny.",
                )
                if description:
                    return {**state, "response_text": description}
                return {**state, "response_text": "Nie mogę teraz przeanalizować zrzutu ekranu."}
        return {**state, "response_text": "Nie udało się wykonać zrzutu ekranu."}

    system_prompt = (
        "Jesteś Volle, voice-native desktop agent. "
        "Mówisz krótko, naturalnie, po polsku. Nie używasz żargonu technicznego. "
        "Zawsze podawaj konkretne liczby lub nazwy plików. Odpowiadaj tak, jakbyś opowiadał to szefowi "
        "podczas krótkiego briefingu. Nie przepraszaj. Nie zaczynaj od 'Oto analiza...'. "
        "Zacznij od razu od sedna. Maksymalnie 3-4 zdania."
    )

    parts = [
        f"Intencja: {intent}",
        f"Pamięć: {memory}",
        f"Użytkownik pyta: {user_msg}",
    ]
    if draft:
        parts.append(f"Wstępna odpowiedź: {draft}")
    if tool_results:
        parts.append(
            f"Wyniki narzędzi (JSON): {json.dumps(tool_results, ensure_ascii=False)}\n"
            "Przedstaw wyniki naturalnie, po polsku, używając konkretnych liczb lub nazw."
        )
    else:
        parts.append("Odpowiedz bezpośrednio na pytanie użytkownika.")

    prompt = "\n\n".join(parts)
    llm_text = await llm.chat(prompt, system_prompt=system_prompt)
    if llm_text:
        final_text = llm_text
    elif tool_results:
        final_text = _format_tool_results(intent, tool_results)
    else:
        final_text = draft or "Przepraszam, nie mogę teraz odpowiedzieć."
    return {**state, "response_text": final_text}


def _format_tool_results(intent: str, tool_results: list[Any]) -> str:
    """Generate natural Polish text from tool results when LLM is unavailable."""
    for result in tool_results:
        if isinstance(result, dict) and "error" in result:
            continue
        if not isinstance(result, dict):
            continue

        # Desktop organize
        if "files_moved" in result or "folders_created" in result:
            files = result.get("files_moved", 0)
            folders = result.get("folders_created", 0)
            return f"Uporządkowałem {files} plików i utworzyłem {folders} folderów."

        # Send email
        if "recipient" in result or "sent" in result:
            recipient = result.get("recipient", "adresata")
            return f"Wysłałem email do {recipient}."

        # Open app
        if "app" in result:
            return f"Otworzyłem aplikację {result['app']}."

        # Screenshot
        if "screenshot_path" in result:
            return "Zrobiłem zrzut ekranu."

        # Clipboard
        if "clipboard_action" in result:
            return f"Wykonałem akcję schowka: {result['clipboard_action']}."

        # Type text
        if "typed" in result:
            return f"Wpisano tekst: {result['typed']}."

        # compare_periods
        if "period_a" in result and "period_b" in result:
            a_stats = result["period_a"]["stats"]
            b_stats = result["period_b"]["stats"]
            diff = result.get("differences", {})
            rev_pct = diff.get("revenue_pct")
            ord_pct = diff.get("orders_pct")
            lines = [
                f"W okresie {result['period_a']['start']} do {result['period_a']['end']} "
                f"mieliśmy {a_stats['orders']} zamówień na kwotę {a_stats['revenue']:,.0f} zł."
            ]
            if rev_pct is not None:
                trend = "wyżej" if rev_pct > 0 else "niżej"
                lines.append(
                    f"To o {abs(rev_pct):.0f} procent {trend} niż w porównywanym okresie."
                )
            elif ord_pct is not None:
                trend = "więcej" if ord_pct > 0 else "mniej"
                lines.append(
                    f"To o {abs(ord_pct):.0f} procent {trend} zamówień niż w porównywanym okresie."
                )
            return " ".join(lines)

        # get_sales_summary
        if "total_orders" in result:
            top_products = result.get("top_products_by_revenue", {})
            top_name = list(top_products.keys())[0] if top_products else "brak danych"
            return (
                f"W okresie od {result['date_from']} do {result['date_to']} "
                f"zrealizowaliśmy {result['total_orders']} zamówień "
                f"na kwotę {result['total_revenue']:,.0f} zł. "
                f"Najlepszy produkt: {top_name}."
            )

        # Web search
        if "results" in result:
            items = result["results"][:2]
            snippets = [f"{r.get('title', '')}: {r.get('snippet', r.get('url', ''))}" for r in items]
            return "Oto co znalazłem: " + "; ".join(snippets)

    return "Mam dane, ale nie mogę ich teraz sformatować."


# ---------------------------------------------------------------------------
# Card builder helpers
# ---------------------------------------------------------------------------

def _card_from_sales_summary(result: dict[str, Any]) -> dict[str, Any]:
    top_products = result.get("top_products_by_revenue", {})
    top_name = list(top_products.keys())[0] if top_products else "brak danych"
    return {
        "title": "Podsumowanie sprzedaży",
        "type": "metrics",
        "metrics": [
            {"label": "Zamówienia", "value": f"{result['total_orders']}"},
            {"label": "Przychód", "value": f"{result['total_revenue']:,.0f} PLN"},
            {"label": "Zrealizowane", "value": f"{result.get('completed_orders', 0)}"},
            {"label": "Top produkt", "value": top_name},
        ],
    }


def _card_from_compare_periods(result: dict[str, Any]) -> dict[str, Any]:
    a = result["period_a"]["stats"]
    b = result["period_b"]["stats"]
    diff = result.get("differences", {})
    return {
        "title": "Porównanie okresów",
        "type": "metrics",
        "metrics": [
            {"label": "Okres A (przychód)", "value": f"{a['revenue']:,.0f} PLN"},
            {"label": "Okres B (przychód)", "value": f"{b['revenue']:,.0f} PLN"},
            {"label": "Różnica przychodu", "value": f"{diff.get('revenue_pct', 0):+.0f}%"},
            {"label": "Różnica zamówień", "value": f"{diff.get('orders_pct', 0):+.0f}%"},
        ],
    }


def _card_from_desktop_actions(results: list[dict[str, Any]]) -> dict[str, Any] | None:
    actions: list[dict[str, str]] = []
    for result in results:
        if not isinstance(result, dict):
            continue
        if "files_moved" in result:
            actions.append({"icon": "📁", "text": f"Uporządkowano {result.get('files_moved', 0)} plików", "path": str(result.get("desktop", result.get("directory", "")))})
        if "recipient" in result:
            actions.append({"icon": "✉️", "text": f"Wysłano email do {result.get('recipient', '')}"})
        if "app" in result:
            actions.append({"icon": "🖥️", "text": f"Otworzono aplikację {result.get('app', '')}", "app": result.get("app", "")})
        if "screenshot_path" in result:
            actions.append({"icon": "📸", "text": "Zrzut ekranu zapisany", "path": result.get("screenshot_path", "")})
        if "clipboard_action" in result:
            actions.append({"icon": "📋", "text": f"Schowek: {result.get('clipboard_action', '')}"})
        if "typed" in result:
            actions.append({"icon": "⌨️", "text": f"Wpisano: {result.get('typed', '')}"})
    if actions:
        return {"title": "Wykonano", "type": "action", "actions": actions}
    return None


def build_card(state: GraphState) -> GraphState:
    """Build a visual card from tool_results based on intent."""
    intent = state.get("current_intent", "").lower()
    results = state.get("tool_results", [])

    card: dict[str, Any] | None = None
    sales_intents = {"sales", "sales_summary", "analytics", "sprzedaż", "analiza", "revenue", "orders", "podsumowanie", "compare"}
    desktop_intents = {"organize", "email", "open", "screenshot", "clipboard", "type", "vision"}

    if intent == "vision":
        card = {"title": "Analiza ekranu", "type": "action", "actions": [{"icon": "👁️", "text": "Zrzut ekranu zanalizowany"}]}
    elif intent in sales_intents:
        for result in results:
            if not isinstance(result, dict):
                continue
            if "total_orders" in result:
                card = _card_from_sales_summary(result)
                break
            if "period_a" in result and "period_b" in result:
                card = _card_from_compare_periods(result)
                break

    if intent in desktop_intents:
        card = _card_from_desktop_actions(results)

    return {**state, "visual_card": card}


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

async def run_pipeline(user_text: str, session_id: str | None = None) -> dict[str, Any]:
    """Run the agent pipeline: understand -> tools -> respond -> card."""
    user = await UserRepo().get_or_create()
    user_id = user["id"]
    sid = session_id or await SessionRepo().create(user_id)
    memory = await _load_memory(user_id)

    state: GraphState = {
        "messages": [{"role": "user", "content": user_text}],
        "current_intent": "",
        "tool_calls": [],
        "tool_results": [],
        "response_text": "",
        "visual_card": None,
        "memory_context": memory,
        "user_id": user_id,
        "session_id": sid,
    }
    state = await understand(state)
    next_node = route(state)
    if next_node == "tool_calling":
        needs_confirm = False
        pending_tool = None
        pending_args = None
        for call in state.get("tool_calls", []):
            name = call.get("name", "")
            args = call.get("args", {})
            if mcp_client.requires_approval(name):
                needs_confirm = True
                pending_tool = name
                pending_args = args
                break
        if needs_confirm:
            confirm_messages = {
                "organize_desktop": "Chcę uporządkować Twój pulpit. Przeniosę pliki do folderów według typu. Potwierdź?",
                "desktop_organize": "Chcę uporządkować Twój pulpit. Przeniosę pliki do folderów według typu. Potwierdź?",
                "move_files": "Chcę przenieść pliki. Potwierdź?",
                "sort_files_by_date": "Chcę posortować pliki według daty. Potwierdź?",
                "send_email": "Chcę wysłać email. Potwierdź?",
                "type_text": "Chcę wpisać tekst. Potwierdź?",
                "clipboard_write": "Chcę zapisać coś do schowka. Potwierdź?",
                "clipboard_action": "Chcę wykonać akcję na schowku. Potwierdź?",
                "open_app": "Chcę otworzyć aplikację. Potwierdź?",
                "open_application": "Chcę otworzyć aplikację. Potwierdź?",
                "open_folder": "Chcę otworzyć folder. Potwierdź?",
            }
            msg = confirm_messages.get(pending_tool, f"Chcę wykonać akcję {pending_tool}. Potwierdź?")
            return {
                "text": msg,
                "needs_confirmation": True,
                "pending_action": {"tool": pending_tool, "args": pending_args},
                "session_id": sid,
                "card": None,
            }
        state = await call_tools(state)
    state = await generate_response(state)
    state = build_card(state)

    # Persist conversation
    await SessionRepo().add_message(
        session_id=sid,
        role="user",
        content=user_text,
    )
    await SessionRepo().add_message(
        session_id=sid,
        role="assistant",
        content=state.get("response_text", ""),
        tool_calls=state.get("tool_calls"),
        tool_results=state.get("tool_results"),
        visual_card=state.get("visual_card"),
    )

    return {
        "text": state.get("response_text", ""),
        "card": state.get("visual_card"),
        "intent": state.get("current_intent", ""),
        "session_id": sid,
    }


async def handle_confirmation(session_id: str, tool: str, args: dict[str, Any]) -> dict[str, Any]:
    """Execute a pending tool after user confirmation and return full response."""
    result = await mcp_client.call_tool(tool, args)
    try:
        parsed = json.loads(result)
    except Exception:
        parsed = result

    intent_map = {
        "organize_desktop": "organize",
        "desktop_organize": "organize",
        "move_files": "organize",
        "sort_files_by_date": "organize",
        "send_email": "email",
        "type_text": "type",
        "clipboard_action": "clipboard",
        "clipboard_write": "clipboard",
        "open_app": "open",
        "open_application": "open",
        "open_folder": "open",
    }
    intent = intent_map.get(tool, "direct")

    fake_state: GraphState = {
        "messages": [{"role": "user", "content": "Potwierdzono akcję."}],
        "current_intent": intent,
        "tool_calls": [{"name": tool, "args": args}],
        "tool_results": [parsed],
        "response_text": "",
        "visual_card": None,
        "memory_context": "",
        "user_id": 0,
        "session_id": session_id,
    }
    fake_state = await generate_response(fake_state)
    fake_state = build_card(fake_state)

    return {
        "text": fake_state["response_text"],
        "card": fake_state["visual_card"],
        "intent": intent,
        "session_id": session_id,
    }
