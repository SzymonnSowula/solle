#!/usr/bin/env python3
"""Business Data & Analytics MCP Server"""

import json
import os
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("business-data")

CSV_PATH = "/home/szymon/volle/data/mock/sales_data.csv"


def _load_df():
    import pandas as pd
    df = pd.read_csv(CSV_PATH)
    df["date"] = pd.to_datetime(df["date"])
    return df


@mcp.tool()
def get_sales_summary(date_from: str, date_to: str) -> str:
    """Get aggregated sales summary for a date range."""
    df = _load_df()
    mask = (df["date"] >= date_from) & (df["date"] <= date_to)
    filtered = df.loc[mask]

    total_orders = int(filtered["order_id"].nunique())
    total_revenue = float(filtered["amount"].sum())
    total_items = int(filtered["quantity"].sum())
    completed_orders = int(filtered[filtered["status"] == "completed"]["order_id"].nunique())
    refunded_orders = int(filtered[filtered["status"] == "refunded"]["order_id"].nunique())

    top_products = (
        filtered.groupby("product")["amount"]
        .sum()
        .sort_values(ascending=False)
        .head(5)
        .to_dict()
    )
    top_products = {k: float(v) for k, v in top_products.items()}

    result = {
        "date_from": date_from,
        "date_to": date_to,
        "total_orders": total_orders,
        "completed_orders": completed_orders,
        "refunded_orders": refunded_orders,
        "total_revenue": round(total_revenue, 2),
        "total_items_sold": total_items,
        "top_products_by_revenue": top_products,
    }
    return json.dumps(result, ensure_ascii=False)


@mcp.tool()
def compare_periods(period_a_start: str, period_a_end: str,
                    period_b_start: str, period_b_end: str) -> str:
    """Compare two sales periods."""
    df = _load_df()

    def _period_stats(start: str, end: str):
        mask = (df["date"] >= start) & (df["date"] <= end)
        f = df.loc[mask]
        return {
            "orders": int(f["order_id"].nunique()),
            "revenue": float(f["amount"].sum()),
            "items": int(f["quantity"].sum()),
            "completed": int(f[f["status"] == "completed"]["order_id"].nunique()),
            "refunded": int(f[f["status"] == "refunded"]["order_id"].nunique()),
        }

    a = _period_stats(period_a_start, period_a_end)
    b = _period_stats(period_b_start, period_b_end)

    def _pct_diff(av, bv):
        if bv == 0:
            return None
        return round(((av - bv) / bv) * 100, 2)

    diff = {
        "orders_pct": _pct_diff(a["orders"], b["orders"]),
        "revenue_pct": _pct_diff(a["revenue"], b["revenue"]),
        "items_pct": _pct_diff(a["items"], b["items"]),
    }

    result = {
        "period_a": {
            "start": period_a_start,
            "end": period_a_end,
            "stats": {k: round(v, 2) if isinstance(v, float) else v for k, v in a.items()},
        },
        "period_b": {
            "start": period_b_start,
            "end": period_b_end,
            "stats": {k: round(v, 2) if isinstance(v, float) else v for k, v in b.items()},
        },
        "differences": diff,
    }
    return json.dumps(result, ensure_ascii=False)


@mcp.tool()
def get_inventory_status() -> str:
    """Check low stock items."""
    return json.dumps({"status": "no_inventory_data", "message": "Inventory data not available yet."}, ensure_ascii=False)


if __name__ == "__main__":
    mcp.run(transport="stdio")
