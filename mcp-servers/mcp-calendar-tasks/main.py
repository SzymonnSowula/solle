#!/usr/bin/env python3
"""Calendar & Tasks MCP Server"""

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("calendar-tasks")

@mcp.tool()
def list_events(date_from: str, date_to: str) -> str:
    """List calendar events."""
    return f"Mock: 2 events between {date_from} and {date_to}"

@mcp.tool()
def create_event(title: str, start_time: str, end_time: str) -> str:
    """Create a calendar event."""
    return f"Mock: created event '{title}'"

if __name__ == "__main__":
    mcp.run(transport="stdio")
