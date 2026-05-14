#!/usr/bin/env python3
"""MCP client registry and routing for local stdio MCP servers."""

from __future__ import annotations

import asyncio
import logging
from contextlib import AsyncExitStack
from dataclasses import dataclass, field
from datetime import timedelta
from pathlib import Path
from typing import Any

from mcp.client.session import ClientSession
from mcp.client.stdio import StdioServerParameters, stdio_client

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Server configuration
# ---------------------------------------------------------------------------

DEFAULT_SERVERS: dict[str, list[str]] = {
    "business-data": ["python", str(Path("/home/szymon/volle/mcp-servers/mcp-business-data/main.py"))],
    "shopify": ["python", str(Path("/home/szymon/volle/mcp-servers/mcp-shopify/main.py"))],
    "web-research": ["python", str(Path("/home/szymon/volle/mcp-servers/mcp-web-research/main.py"))],
    "calendar-tasks": ["python", str(Path("/home/szymon/volle/mcp-servers/mcp-calendar-tasks/main.py"))],
    "email-drafts": ["python", str(Path("/home/szymon/volle/mcp-servers/mcp-email-drafts/main.py"))],
}

# ---------------------------------------------------------------------------
# Safety tiers
# ---------------------------------------------------------------------------

SAFETY_TIERS: dict[str, str] = {
    # Green – read-only / low risk
    "web_search": "green",
    "fetch_page": "green",
    "get_sales_summary": "green",
    "compare_periods": "green",
    "get_inventory_status": "green",
    # Yellow – mutating but reversible
    "create_event": "yellow",
    "create_task": "yellow",
    "draft_email": "yellow",
    "list_drafts": "yellow",
    "list_events": "yellow",
    # Orange – financial / business-critical
    "get_orders": "orange",
    "get_products": "orange",
}


def requires_approval(tool_name: str) -> bool:
    """Return True if the tool is classified as Yellow or Orange."""
    tier = SAFETY_TIERS.get(tool_name)
    if tier is None:
        tier = "orange"  # unknown tools default to cautious
    return tier in ("yellow", "orange")


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class ServerConnection:
    """Holds the runtime connection state for a single MCP server."""

    name: str
    params: StdioServerParameters
    session: ClientSession | None = None
    tools: list[dict[str, Any]] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------

class MCPRegistry:
    """Manages multiple stdio MCP servers, discovers tools, and routes calls."""

    def __init__(self, servers: dict[str, list[str]] | None = None) -> None:
        """
        Args:
            servers: Mapping from server name to command arguments list.
                     e.g. {"business-data": ["python", "/path/to/main.py"]}
        """
        self._servers_cfg = servers or DEFAULT_SERVERS
        self._connections: dict[str, ServerConnection] = {}
        self._tool_to_server: dict[str, str] = {}
        self._exit_stack = AsyncExitStack()
        self._lock = asyncio.Lock()

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def start_all(self) -> None:
        """Launch all configured stdio sessions, initialize, and discover tools."""
        async with self._lock:
            for name, cmd in self._servers_cfg.items():
                if not cmd:
                    logger.warning("Empty command for server %s; skipping", name)
                    continue

                params = StdioServerParameters(
                    command=cmd[0],
                    args=cmd[1:],
                )
                conn = ServerConnection(name=name, params=params)

                try:
                    logger.info("Starting MCP server: %s", name)
                    read_stream, write_stream = await self._exit_stack.enter_async_context(
                        stdio_client(params)
                    )
                    session = ClientSession(read_stream, write_stream)
                    await session.initialize()
                    conn.session = session

                    # Discover tools
                    tools_result = await session.list_tools()
                    conn.tools = []
                    for tool in tools_result.tools:
                        tool_info = {
                            "name": tool.name,
                            "description": getattr(tool, "description", "") or "",
                            "server": name,
                        }
                        conn.tools.append(tool_info)
                        self._tool_to_server[tool.name] = name
                        logger.debug(
                            "Registered tool %s from server %s", tool.name, name
                        )

                    self._connections[name] = conn
                    logger.info(
                        "Server %s ready with %d tool(s)", name, len(conn.tools)
                    )
                except Exception as exc:
                    logger.error("Failed to start server %s: %s", name, exc)
                    # Do not crash; continue with remaining servers

    async def stop_all(self) -> None:
        """Close all stdio sessions and terminate subprocesses."""
        async with self._lock:
            self._tool_to_server.clear()
            self._connections.clear()
            try:
                await self._exit_stack.aclose()
            except Exception as exc:
                logger.error("Error during shutdown: %s", exc)
            finally:
                self._exit_stack = AsyncExitStack()

    # ------------------------------------------------------------------
    # Tool introspection
    # ------------------------------------------------------------------

    def list_tools(self) -> list[dict[str, str]]:
        """Return a flat list of every tool with name, description, and server."""
        tools: list[dict[str, str]] = []
        for conn in self._connections.values():
            tools.extend(
                {
                    "name": t["name"],
                    "description": t["description"],
                    "server": conn.name,
                }
                for t in conn.tools
            )
        return tools

    # ------------------------------------------------------------------
    # Tool execution
    # ------------------------------------------------------------------

    async def call_tool(self, name: str, arguments: dict[str, Any] | None = None) -> str:
        """
        Route a tool call to the owning server and return the result as a string.

        Args:
            name: Tool name.
            arguments: JSON-serializable arguments dict.

        Returns:
            Result text or an error message (never raises).
        """
        server_name = self._tool_to_server.get(name)
        if server_name is None:
            return f"[error] Tool '{name}' is not registered in any MCP server."

        conn = self._connections.get(server_name)
        if conn is None or conn.session is None:
            return f"[error] Server '{server_name}' for tool '{name}' is not connected."

        try:
            result = await asyncio.wait_for(
                conn.session.call_tool(
                    name=name,
                    arguments=arguments,
                    read_timeout_seconds=timedelta(seconds=10),
                ),
                timeout=12.0,  # overall guard including transport overhead
            )
        except asyncio.TimeoutError:
            logger.error("Tool '%s' on server '%s' timed out", name, server_name)
            return f"[error] Tool '{name}' timed out after 10s."
        except Exception as exc:
            logger.error("Tool '%s' on server '%s' failed: %s", name, server_name, exc)
            return f"[error] Tool '{name}' failed: {exc}"

        # Convert CallToolResult -> string
        if result.isError:
            return f"[error] Tool '{name}' returned an error."

        texts: list[str] = []
        for content in result.content:
            text = getattr(content, "text", None)
            if text is not None:
                texts.append(text)
            else:
                texts.append(str(content))
        return "\n".join(texts) if texts else ""


# ---------------------------------------------------------------------------
# Singleton convenience exports
# ---------------------------------------------------------------------------

registry = MCPRegistry()
call_tool = registry.call_tool
