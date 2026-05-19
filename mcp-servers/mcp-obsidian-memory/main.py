#!/usr/bin/env python3
"""Obsidian Memory Bridge MCP Server.

Reads and writes the user's Obsidian vault for long-term context.
Primary target: Windows via WSL path mapping.
"""

from __future__ import annotations

import fnmatch
import json
import os
from pathlib import Path

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("obsidian-memory")

# Default vault path (Windows host via WSL)
_DEFAULT_VAULT = os.getenv(
    "OBSIDIAN_VAULT_PATH",
    "/mnt/c/Users/szymo/Documents/Obsidian Vault",
)


def _vault() -> Path:
    return Path(_DEFAULT_VAULT).expanduser().resolve()


def _safe_path(relative: str) -> Path:
    """Resolve a path inside the vault, preventing directory traversal."""
    vault = _vault()
    target = (vault / relative).resolve()
    # Ensure target is inside vault
    if not str(target).startswith(str(vault)):
        raise ValueError("Path outside vault")
    return target


@mcp.tool()
def list_notes(folder: str = "") -> str:
    """List markdown notes in the vault or a subfolder.

    Args:
        folder: Relative folder path inside vault (e.g. "Projects/Volle").
    """
    try:
        path = _safe_path(folder) if folder else _vault()
        if not path.exists():
            return json.dumps({"error": f"Folder not found: {folder}"}, ensure_ascii=False)
        notes = []
        for entry in path.rglob("*.md"):
            rel = entry.relative_to(_vault())
            notes.append(str(rel))
        notes.sort()
        return json.dumps({"vault": str(_vault()), "notes": notes}, ensure_ascii=False)
    except Exception as exc:
        return json.dumps({"error": str(exc)}, ensure_ascii=False)


@mcp.tool()
def read_note(relative_path: str) -> str:
    """Read the contents of a markdown note.

    Args:
        relative_path: Relative path inside vault, e.g. "Daily/2026-05-18.md".
    """
    try:
        path = _safe_path(relative_path)
        if not path.exists():
            return json.dumps({"error": f"Note not found: {relative_path}"}, ensure_ascii=False)
        content = path.read_text(encoding="utf-8")
        return json.dumps({
            "path": relative_path,
            "content": content,
            "size": len(content),
        }, ensure_ascii=False)
    except Exception as exc:
        return json.dumps({"error": str(exc)}, ensure_ascii=False)


@mcp.tool()
def search_notes(query: str, folder: str = "") -> str:
    """Search notes by filename pattern or content keyword.

    Args:
        query: Search term (case-insensitive, supports * wildcards for filenames).
        folder: Restrict search to a subfolder.
    """
    try:
        path = _safe_path(folder) if folder else _vault()
        if not path.exists():
            return json.dumps({"error": f"Folder not found: {folder}"}, ensure_ascii=False)

        results = []
        q = query.lower()
        for entry in path.rglob("*.md"):
            rel = str(entry.relative_to(_vault()))
            name_match = fnmatch.fnmatch(rel.lower(), f"*{q}*") or fnmatch.fnmatch(entry.stem.lower(), f"*{q}*")
            content_match = False
            snippet = ""
            if entry.is_file():
                try:
                    text = entry.read_text(encoding="utf-8", errors="ignore").lower()
                    content_match = q in text
                    if content_match:
                        idx = text.find(q)
                        start = max(0, idx - 80)
                        end = min(len(text), idx + 120)
                        snippet = entry.read_text(encoding="utf-8", errors="ignore")[start:end]
                except Exception:
                    pass
            if name_match or content_match:
                results.append({"path": rel, "snippet": snippet})
        return json.dumps({"results": results, "count": len(results)}, ensure_ascii=False)
    except Exception as exc:
        return json.dumps({"error": str(exc)}, ensure_ascii=False)


@mcp.tool()
def write_note(relative_path: str, content: str, append: bool = False) -> str:
    """Write or append to a markdown note in the vault.

    Args:
        relative_path: Relative path inside vault.
        content: Markdown text to write.
        append: If True, append to existing file; otherwise overwrite.
    """
    try:
        path = _safe_path(relative_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        if append and path.exists():
            existing = path.read_text(encoding="utf-8")
            new_content = existing + "\n\n" + content
        else:
            new_content = content
        path.write_text(new_content, encoding="utf-8")
        return json.dumps({
            "path": relative_path,
            "status": "written" if not append else "appended",
            "size": len(new_content),
        }, ensure_ascii=False)
    except Exception as exc:
        return json.dumps({"error": str(exc)}, ensure_ascii=False)


@mcp.tool()
def delete_note(relative_path: str) -> str:
    """Delete a markdown note.

    Args:
        relative_path: Relative path inside vault.
    """
    try:
        path = _safe_path(relative_path)
        if not path.exists():
            return json.dumps({"error": f"Note not found: {relative_path}"}, ensure_ascii=False)
        path.unlink()
        return json.dumps({"path": relative_path, "status": "deleted"}, ensure_ascii=False)
    except Exception as exc:
        return json.dumps({"error": str(exc)}, ensure_ascii=False)


if __name__ == "__main__":
    mcp.run(transport="stdio")
