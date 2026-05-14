#!/usr/bin/env python3
"""MCP client registry and routing for local stdio MCP servers.

Uses a lightweight asyncio-subprocess JSON-RPC transport instead of the
official MCP stdio_client to avoid anyio/task cancel-scope hangs in this
environment.
"""

from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Server configuration
# ---------------------------------------------------------------------------

_VENV_PYTHON = str(Path("/home/szymon/volle/apps/agent-worker/.venv/bin/python"))

DEFAULT_SERVERS: dict[str, list[str]] = {
    "business-data": [_VENV_PYTHON, str(Path("/home/szymon/volle/mcp-servers/mcp-business-data/main.py"))],
    "shopify": [_VENV_PYTHON, str(Path("/home/szymon/volle/mcp-servers/mcp-shopify/main.py"))],
    "web-research": [_VENV_PYTHON, str(Path("/home/szymon/volle/mcp-servers/mcp-web-research/main.py"))],
    "calendar-tasks": [_VENV_PYTHON, str(Path("/home/szymon/volle/mcp-servers/mcp-calendar-tasks/main.py"))],
    "email-drafts": [_VENV_PYTHON, str(Path("/home/szymon/volle/mcp-servers/mcp-email-drafts/main.py"))],
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
# Subprocess JSON-RPC client
# ---------------------------------------------------------------------------

class _SubprocessMCPClient:
    """Low-level JSON-RPC client over asyncio subprocess stdin/stdout."""

    def __init__(self, cmd: list[str]) -> None:
        self.cmd = cmd
        self.proc: asyncio.subprocess.Process | None = None
        self._req_id = 1
        self._lock = asyncio.Lock()

    async def start(self) -> None:
        self.proc = await asyncio.create_subprocess_exec(
            *self.cmd,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        # initialize handshake
        await self._request("initialize", {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": "volle", "version": "1.0"},
        })
        # send initialized notification
        await self._send({"jsonrpc": "2.0", "method": "notifications/initialized"})

    async def stop(self) -> None:
        if self.proc is None:
            return
        try:
            self.proc.stdin.close()
            await asyncio.wait_for(self.proc.wait(), timeout=2.0)
        except asyncio.TimeoutError:
            self.proc.kill()
            await self.proc.wait()
        finally:
            self.proc = None

    async def list_tools(self) -> list[dict[str, Any]]:
        resp = await self._request("tools/list")
        result = resp.get("result", {})
        return result.get("tools", [])

    async def call_tool(self, name: str, arguments: dict[str, Any] | None = None) -> dict[str, Any]:
        return await self._request("tools/call", {"name": name, "arguments": arguments or {}})

    async def _request(self, method: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        async with self._lock:
            self._req_id += 1
            payload: dict[str, Any] = {"jsonrpc": "2.0", "id": self._req_id, "method": method}
            if params is not None:
                payload["params"] = params
            await self._send(payload)
            return await self._read_one()

    async def _send(self, obj: dict[str, Any]) -> None:
        if self.proc is None or self.proc.stdin is None:
            raise RuntimeError("MCP client not started")
        line = json.dumps(obj) + "\n"
        self.proc.stdin.write(line.encode())
        await self.proc.stdin.drain()

    async def _read_one(self) -> dict[str, Any]:
        if self.proc is None or self.proc.stdout is None:
            raise RuntimeError("MCP client not started")
        while True:
            data = await asyncio.wait_for(self.proc.stdout.readline(), timeout=15.0)
            if not data:
                raise EOFError("MCP server closed stdout")
            line = data.decode().strip()
            if not line:
                continue
            try:
                return json.loads(line)
            except json.JSONDecodeError:
                continue


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class ServerConnection:
    """Holds the runtime connection state for a single MCP server."""

    name: str
    cmd: list[str]
    client: _SubprocessMCPClient
    tools: list[dict[str, Any]] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------

class MCPRegistry:
    """Manages multiple stdio MCP servers, discovers tools, and routes calls."""

    def __init__(self, servers: dict[str, list[str]] | None = None) -> None:
        self._servers_cfg = servers or DEFAULT_SERVERS
        self._connections: dict[str, ServerConnection] = {}
        self._tool_to_server: dict[str, str] = {}
        self._lock = asyncio.Lock()

    async def start_all(self) -> None:
        async with self._lock:
            for name, cmd in self._servers_cfg.items():
                if not cmd:
                    logger.warning("Empty command for server %s; skipping", name)
                    continue
                try:
                    logger.info("Starting MCP server: %s", name)
                    client = _SubprocessMCPClient(cmd)
                    await client.start()
                    raw_tools = await client.list_tools()
                    tools = []
                    for tool in raw_tools:
                        tool_info = {
                            "name": tool.get("name", ""),
                            "description": tool.get("description", ""),
                            "server": name,
                        }
                        tools.append(tool_info)
                        self._tool_to_server[tool_info["name"]] = name
                    conn = ServerConnection(name=name, cmd=cmd, client=client, tools=tools)
                    self._connections[name] = conn
                    logger.info("Server %s ready with %d tool(s)", name, len(tools))
                except Exception as exc:
                    logger.error("Failed to start server %s: %s", name, exc)

    async def stop_all(self) -> None:
        async with self._lock:
            self._tool_to_server.clear()
            for conn in list(self._connections.values()):
                try:
                    await conn.client.stop()
                except Exception as exc:
                    logger.error("Error stopping server %s: %s", conn.name, exc)
            self._connections.clear()

    def list_tools(self) -> list[dict[str, str]]:
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

    async def call_tool(self, name: str, arguments: dict[str, Any] | None = None) -> str:
        server_name = self._tool_to_server.get(name)
        if server_name is None:
            return f"[error] Tool '{name}' is not registered in any MCP server."

        conn = self._connections.get(server_name)
        if conn is None:
            return f"[error] Server '{server_name}' for tool '{name}' is not connected."

        try:
            resp = await asyncio.wait_for(
                conn.client.call_tool(name, arguments),
                timeout=15.0,
            )
        except asyncio.TimeoutError:
            logger.error("Tool '%s' on server '%s' timed out", name, server_name)
            return f"[error] Tool '{name}' timed out after 15s."
        except Exception as exc:
            logger.error("Tool '%s' on server '%s' failed: %s", name, server_name, exc)
            return f"[error] Tool '{name}' failed: {exc}"

        result = resp.get("result", {})
        content = result.get("content", [])
        texts: list[str] = []
        for item in content:
            if isinstance(item, dict) and "text" in item:
                texts.append(item["text"])
            else:
                texts.append(str(item))
        return "\n".join(texts) if texts else ""


# ---------------------------------------------------------------------------
# Singleton convenience exports
# ---------------------------------------------------------------------------

registry = MCPRegistry()
call_tool = registry.call_tool
