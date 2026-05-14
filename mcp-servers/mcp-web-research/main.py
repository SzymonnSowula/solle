#!/usr/bin/env python3
"""Web Research MCP Server"""

import json
import re
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("web-research")


def _strip_html(html: str) -> str:
    text = re.sub(r"<script[^>]*>.*?</script>", "", html, flags=re.DOTALL)
    text = re.sub(r"<style[^>]*>.*?</style>", "", text, flags=re.DOTALL)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"&nbsp;", " ", text)
    text = re.sub(r"&[a-zA-Z]+;", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _extract_ddg_url(href: str) -> str:
    """Extract real URL from DuckDuckGo redirect link."""
    if "uddg=" in href:
        from urllib.parse import unquote, parse_qs, urlparse
        parsed = urlparse(href)
        qs = parse_qs(parsed.query)
        if "uddg" in qs:
            return unquote(qs["uddg"][0])
    return href


def _search_ddg_httpx(query: str):
    import httpx
    url = "https://html.duckduckgo.com/html/"
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
    }
    resp = httpx.get(url, params={"q": query}, headers=headers, timeout=15.0, follow_redirects=True)
    resp.raise_for_status()
    html = resp.text
    results = []
    # Parse DuckDuckGo HTML results
    for m in re.finditer(r'<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)</a>', html):
        href = m.group(1)
        title = re.sub(r"<[^>]+>", "", m.group(2)).strip()
        href = _extract_ddg_url(href)
        if href.startswith("//"):
            href = "https:" + href
        results.append({"title": title, "url": href})
    if not results:
        # fallback regex for alternative markup
        for m in re.finditer(r'<a[^>]*href="(https?://[^"]+)"[^>]*>(.*?)</a>', html):
            href = m.group(1)
            title = re.sub(r"<[^>]+>", "", m.group(2)).strip()
            if len(title) > 3 and "duckduckgo" not in href:
                results.append({"title": title, "url": href})
    return results[:5]


@mcp.tool()
def web_search(query: str) -> str:
    """Search the web and return top 5 results."""
    try:
        try:
            from duckduckgo_search import DDGS
            with DDGS() as ddgs:
                results = []
                for r in ddgs.text(query, max_results=5):
                    results.append({
                        "title": r.get("title", ""),
                        "url": r.get("href", ""),
                        "snippet": r.get("body", ""),
                    })
                return json.dumps({"query": query, "results": results}, ensure_ascii=False)
        except Exception:
            results = _search_ddg_httpx(query)
            return json.dumps({"query": query, "results": results}, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"query": query, "error": str(e)}, ensure_ascii=False)


@mcp.tool()
def fetch_page(url: str) -> str:
    """Fetch and return the first 3000 chars of text content from a web page."""
    try:
        import httpx
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
        }
        resp = httpx.get(url, headers=headers, timeout=20.0, follow_redirects=True)
        resp.raise_for_status()
        text = _strip_html(resp.text)
        return json.dumps({"url": url, "text": text[:3000]}, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"url": url, "error": str(e)}, ensure_ascii=False)


if __name__ == "__main__":
    mcp.run(transport="stdio")
