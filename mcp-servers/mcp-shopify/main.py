#!/usr/bin/env python3
"""Shopify MCP Server (read-only MVP)"""

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("shopify")

@mcp.tool()
def get_orders(limit: int = 50) -> str:
    """Fetch recent orders from Shopify."""
    return "Mock: 3 orders retrieved"

@mcp.tool()
def get_products(limit: int = 50) -> str:
    """Fetch product catalog."""
    return "Mock: 10 products retrieved"

if __name__ == "__main__":
    mcp.run(transport="stdio")
