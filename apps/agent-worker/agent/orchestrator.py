"""LangGraph conversation orchestrator for Volle agent.

Implements a state machine:
    idle -> understanding -> tool_calling -> responding -> follow_up
with conditional routing between understanding and (tool_calling | responding).
"""

from __future__ import annotations

import json
from typing import Any, TypedDict

from langgraph.graph import END, StateGraph

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
    If JSON parsing fails the raw LLM text is treated as a direct_response.
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
        # LLM unavailable – fall back to empty intent so downstream can handle gracefully
        return {**state, "current_intent": "unknown", "tool_calls": []}

    cleaned = _strip_code_fences(raw)
    parsed: dict[str, Any] | None = None
    try:
        parsed = json.loads(cleaned)
    except Exception:
        pass

    if parsed is None:
        # Fallback: treat raw text as direct response
        return {**state, "current_intent": "direct", "tool_calls": [], "response_text": raw}

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
    final_text = llm_text if llm_text else draft or "Przepraszam, nie mogę teraz odpowiedzieć."
    return {**state, "response_text": final_text}


def build_card(state: GraphState) -> GraphState:
    """If intent is sales/analytics, build a visual card from tool_results."""
    intent = state.get("current_intent", "").lower()
    results = state.get("tool_results", [])

    card: dict[str, Any] | None = None
    sales_intents = {"sales", "analytics", "sprzedaż", "analiza", "revenue", "orders", "podsumowanie"}

    if intent in sales_intents:
        data: dict[str, Any] | None = None
        for result in results:
            if isinstance(result, dict):
                if "yesterday" in result and "month_avg_daily" in result:
                    data = result
                    break
                if "data" in result and isinstance(result["data"], dict):
                    inner = result["data"]
                    if "yesterday" in inner and "month_avg_daily" in inner:
                        data = inner
                        break

        if data:
            y = data["yesterday"]
            avg = data["month_avg_daily"]
            diff = data["diff"]
            card = {
                "title": "Podsumowanie sprzedaży",
                "metrics": [
                    {"label": "Wczoraj (zamówienia)", "value": f"{y['orders']}"},
                    {"label": "Wczoraj (przychód)", "value": f"{y['revenue_pln']:,.0f} PLN"},
                    {"label": "Średnia dzienna (miesiąc)", "value": f"{avg['revenue_pln']:,.0f} PLN"},
                    {"label": "Różnica przychodu", "value": f"{diff['revenue_pct']:+.0f}%"},
                    {"label": "Różnica zamówień", "value": f"{diff['orders_pct']:+.0f}%"},
                ],
            }

    return {**state, "visual_card": card}


# ---------------------------------------------------------------------------
# Graph builder
# ---------------------------------------------------------------------------

def build_orchestrator():
    """Compile the LangGraph state machine."""
    builder = StateGraph(GraphState)

    builder.add_node("load_memory", load_memory)
    builder.add_node("understand", understand)
    builder.add_node("call_tools", call_tools)
    builder.add_node("generate_response", generate_response)
    builder.add_node("build_card", build_card)

    builder.set_entry_point("load_memory")
    builder.add_edge("load_memory", "understand")
    builder.add_conditional_edges(
        "understand",
        route,
        {"tool_calling": "call_tools", "responding": "generate_response"},
    )
    builder.add_edge("call_tools", "generate_response")
    builder.add_edge("generate_response", "build_card")
    builder.add_edge("build_card", END)

    return builder.compile()


graph = build_orchestrator()


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

async def run_orchestrator(user_text: str) -> dict[str, Any]:
    """Invoke the graph with a single user utterance and return the result dict.

    Returns:
        {"text": str, "card": dict | None, "intent": str}
    """
    initial_state: GraphState = {
        "messages": [{"role": "user", "content": user_text}],
        "current_intent": "",
        "tool_calls": [],
        "tool_results": [],
        "response_text": "",
        "visual_card": None,
        "memory_context": "",
    }
    result = await graph.ainvoke(initial_state)
    return {
        "text": result.get("response_text", ""),
        "card": result.get("visual_card"),
        "intent": result.get("current_intent", ""),
    }
