#!/usr/bin/env python3
"""Email Drafts MCP Server"""

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("email-drafts")

@mcp.tool()
def draft_email(to: str, subject: str, body: str) -> str:
    """Draft an email (does not send in MVP)."""
    return f"Mock: drafted email to {to}"

@mcp.tool()
def list_drafts() -> str:
    """List saved drafts."""
    return "Mock: 0 drafts"

if __name__ == "__main__":
    mcp.run(transport="stdio")
