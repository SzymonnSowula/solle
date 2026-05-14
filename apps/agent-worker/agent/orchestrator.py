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


class GraphState(TypedDict):
    """Shared state carried across graph nodes."""

    messages: list[dict[str, Any]]
    current_intent: str
    tool_calls: list[dict[str, Any]]
    tool_results: list[Any]
    response_text: str
    visual_card: dict[str, Any] | None
    memory_context: str


# ---------------------------------------------------------------------------
# Memory stub (hardcoded until real DB is wired)
# ---------------------------------------------------------------------------
_MEMORY_PROFILE = {
    "user_name": "Szef",
    "company_type": "Mała firma e-commerce",
    "preferred_tone": "Bezpośredni, konkretny",
    "common_metrics": ["przychód", "liczba zamówień", "średnia dzienna"],
}


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
# Nodes
# ---------------------------------------------------------------------------

def load_memory(state: GraphState) -> GraphState:
    """Read hardcoded profile stub and append to state.memory_context."""
    profile_text = (
        f"Użytkownik: {_MEMORY_PROFILE['user_name']}. "
        f"Firma: {_MEMORY_PROFILE['company_type']}. "
        f"Preferowany ton: {_MEMORY_PROFILE['preferred_tone']}. "
        f"Interesujące metryki: {', '.join(_MEMORY_PROFILE['common_metrics'])}."
    )
    return {**state, "memory_context": profile_text}


async def understand(state: GraphState) -> GraphState:
    """Call LLM to extract intent, tool needs and optional direct response.

    The LLM must return a JSON object with keys:
        intent, needs_tool, tool_name, tool_args, direct_response.
    If JSON parsing fails or LLM is unavailable, fall back to deterministic routing.
    """
    user_msg = _last_user_message(state)
    memory = state.get("memory_context", "")

    system_prompt = (
        "Jesteś Volle, voice-native business agent. "
        "Analizuj intencję użytkownika i zwróć WYŁĄCZNIE obiekt JSON w formacie:\n"
        '{\n'
        '  "intent": "nazwa_intencji",\n'
        '  "needs_tool": true/false,\n'
        '  "tool_name": "nazwa_narzędzia_lub_null",\n'
        '  "tool_args": {} lub null,\n'
        '  "direct_response": "krótka odpowiedź bezpośrednia lub null"\n'
        '}\n\n'
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

    has_sales = any(k in text for k in sales_kw)
    has_time = any(k in text for k in time_kw)
    has_compare = any(k in text for k in compare_kw)
    has_search = any(k in text for k in search_kw)

    y = _yesterday()
    m_start = _month_start(y)
    w_start = _week_start(y)

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
            "Spróbuj zapytać o sprzedaż lub konkurencję."
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
    for call in state.get("tool_calls", []):
        name = call.get("name")
        args = call.get("args", {})
        if not name:
            continue
        try:
            result = await mcp_client.call_tool(name, args)
            # Try to parse JSON string into dict for downstream consumption
            try:
                parsed = json.loads(result)
                results.append(parsed)
            except Exception:
                results.append(result)
        except Exception as exc:
            results.append({"error": str(exc), "tool": name})
    return {**state, "tool_results": results}


async def generate_response(state: GraphState) -> GraphState:
    """Build prompt with tool_results (if any) and ask LLM for a final Polish voice response."""
    user_msg = _last_user_message(state)
    memory = state.get("memory_context", "")
    intent = state.get("current_intent", "unknown")
    tool_results = state.get("tool_results", [])
    draft = state.get("response_text", "")

    system_prompt = (
        "Jesteś Volle, voice-native business agent dla właścicieli małych firm. "
        "Mówisz krótko, naturalnie, po polsku. Nie używasz żargonu technicznego. "
        "Zawsze podawaj konkretne liczby. Odpowiadaj tak, jakbyś opowiadał to szefowi "
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
            "Przedstaw wyniki naturalnie, po polsku, używając konkretnych liczb."
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
        "metrics": [
            {"label": "Okres A (przychód)", "value": f"{a['revenue']:,.0f} PLN"},
            {"label": "Okres B (przychód)", "value": f"{b['revenue']:,.0f} PLN"},
            {"label": "Różnica przychodu", "value": f"{diff.get('revenue_pct', 0):+.0f}%"},
            {"label": "Różnica zamówień", "value": f"{diff.get('orders_pct', 0):+.0f}%"},
        ],
    }


def build_card(state: GraphState) -> GraphState:
    """If intent is sales/analytics, build a visual card from tool_results."""
    intent = state.get("current_intent", "").lower()
    results = state.get("tool_results", [])

    card: dict[str, Any] | None = None
    sales_intents = {"sales", "sales_summary", "analytics", "sprzedaż", "analiza", "revenue", "orders", "podsumowanie", "compare"}

    if intent in sales_intents:
        for result in results:
            if not isinstance(result, dict):
                continue

            if "total_orders" in result:
                card = _card_from_sales_summary(result)
                break

            if "period_a" in result and "period_b" in result:
                card = _card_from_compare_periods(result)
                break

    return {**state, "visual_card": card}


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

async def run_pipeline(user_text: str) -> dict[str, Any]:
    """Run the agent pipeline: understand -> tools -> respond -> card."""
    state: GraphState = {
        "messages": [{"role": "user", "content": user_text}],
        "current_intent": "",
        "tool_calls": [],
        "tool_results": [],
        "response_text": "",
        "visual_card": None,
        "memory_context": "",
    }
    state = load_memory(state)
    state = await understand(state)
    next_node = route(state)
    if next_node == "tool_calling":
        state = await call_tools(state)
    state = await generate_response(state)
    state = build_card(state)
    return {
        "text": state.get("response_text", ""),
        "card": state.get("visual_card"),
        "intent": state.get("current_intent", ""),
    }
