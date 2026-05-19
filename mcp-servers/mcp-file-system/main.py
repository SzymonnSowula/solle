#!/usr/bin/env python3
"""File System MCP Server

Cross-platform file management via MCP stdio transport.
Primary target: Windows. Works on Linux/WSL and macOS.
"""

from __future__ import annotations

import json
import mimetypes
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("file-system")

# ---------------------------------------------------------------------------
# Extension categories
# ---------------------------------------------------------------------------

_CATEGORY_MAP: dict[str, str] = {
    # Documents
    ".txt": "Documents",
    ".pdf": "Documents",
    ".doc": "Documents",
    ".docx": "Documents",
    ".odt": "Documents",
    ".rtf": "Documents",
    ".md": "Documents",
    ".csv": "Documents",
    ".xls": "Documents",
    ".xlsx": "Documents",
    ".ppt": "Documents",
    ".pptx": "Documents",
    # Images
    ".jpg": "Images",
    ".jpeg": "Images",
    ".png": "Images",
    ".gif": "Images",
    ".bmp": "Images",
    ".svg": "Images",
    ".webp": "Images",
    ".ico": "Images",
    ".tiff": "Images",
    ".tif": "Images",
    ".heic": "Images",
    # Videos
    ".mp4": "Videos",
    ".avi": "Videos",
    ".mkv": "Videos",
    ".mov": "Videos",
    ".wmv": "Videos",
    ".flv": "Videos",
    ".webm": "Videos",
    ".m4v": "Videos",
    ".mpg": "Videos",
    ".mpeg": "Videos",
    # Archives
    ".zip": "Archives",
    ".rar": "Archives",
    ".7z": "Archives",
    ".tar": "Archives",
    ".gz": "Archives",
    ".bz2": "Archives",
    ".xz": "Archives",
    ".tgz": "Archives",
    ".bz": "Archives",
}


def _resolve_path(path: str) -> Path:
    """Resolve a path, expanding user home and making it absolute."""
    return Path(path).expanduser().resolve()


def _get_category(path: Path) -> str:
    """Return folder category for a file based on its extension."""
    return _CATEGORY_MAP.get(path.suffix.lower(), "Other")


def _file_info(path: Path) -> dict[str, object]:
    """Build metadata dict for a path."""
    try:
        stat = path.stat()
        mime, _ = mimetypes.guess_type(str(path))
        return {
            "name": path.name,
            "path": str(path),
            "is_directory": path.is_dir(),
            "size": stat.st_size,
            "modified": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
            "mime_type": mime or "unknown",
            "category": _get_category(path) if path.is_file() else None,
        }
    except OSError as exc:
        return {
            "name": path.name,
            "path": str(path),
            "error": str(exc),
        }


# ---------------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------------

@mcp.tool()
def list_directory(directory_path: str) -> str:
    """List files in a directory with metadata.

    Args:
        directory_path: Absolute or relative path to the directory.
    """
    path = _resolve_path(directory_path)
    if not path.exists():
        return json.dumps({"error": f"Path does not exist: {directory_path}"}, ensure_ascii=False)
    if not path.is_dir():
        return json.dumps({"error": f"Path is not a directory: {directory_path}"}, ensure_ascii=False)

    try:
        items = [_file_info(entry) for entry in path.iterdir()]
        items.sort(key=lambda x: (not x.get("is_directory", False), str(x.get("name", "")).lower()))
        return json.dumps({"directory": str(path), "items": items}, ensure_ascii=False, default=str)
    except Exception as exc:
        return json.dumps({"error": str(exc)}, ensure_ascii=False)


@mcp.tool()
def get_file_info(file_path: str) -> str:
    """Return size, modified date, and type of a file.

    Args:
        file_path: Absolute or relative path to the file.
    """
    path = _resolve_path(file_path)
    if not path.exists():
        return json.dumps({"error": f"Path does not exist: {file_path}"}, ensure_ascii=False)

    try:
        info = _file_info(path)
        return json.dumps(info, ensure_ascii=False, default=str)
    except Exception as exc:
        return json.dumps({"error": str(exc)}, ensure_ascii=False)


@mcp.tool()
def move_files(source_paths: list[str], destination_directory: str) -> str:
    """Move files from source paths to a destination directory.

    Args:
        source_paths: List of absolute or relative file paths to move.
        destination_directory: Target directory path.
    """
    dest = _resolve_path(destination_directory)
    if not dest.exists():
        try:
            dest.mkdir(parents=True, exist_ok=True)
        except Exception as exc:
            return json.dumps({"error": f"Failed to create destination: {exc}"}, ensure_ascii=False)
    if not dest.is_dir():
        return json.dumps({"error": f"Destination is not a directory: {destination_directory}"}, ensure_ascii=False)

    results: list[dict[str, object]] = []
    undo_moves: list[dict[str, str]] = []
    for src_str in source_paths:
        src = _resolve_path(src_str)
        if not src.exists():
            results.append({"source": src_str, "status": "error", "reason": "Path does not exist"})
            continue
        try:
            target = dest / src.name
            # Handle name collision by appending a counter
            counter = 1
            stem = target.stem
            suffix = target.suffix
            while target.exists():
                target = dest / f"{stem}_{counter}{suffix}"
                counter += 1
            shutil.move(str(src), str(target))
            results.append({"source": str(src), "destination": str(target), "status": "moved"})
            undo_moves.append({"source": str(src), "destination": str(target)})
        except Exception as exc:
            results.append({"source": str(src), "status": "error", "reason": str(exc)})

    return json.dumps({"results": results, "undo_data": {"tool": "move_files", "moves": undo_moves}}, ensure_ascii=False, default=str)


@mcp.tool()
def organize_desktop(desktop_path: str | None = None) -> str:
    """Move files from Desktop into subfolders by extension (Documents, Images, Videos, Archives, Other).

    Args:
        desktop_path: Optional path to the Desktop folder. Defaults to ~/Desktop.
    """
    if desktop_path:
        desktop = _resolve_path(desktop_path)
    else:
        desktop = Path.home() / "Desktop"

    if not desktop.exists():
        return json.dumps({"error": f"Desktop path does not exist: {desktop}"}, ensure_ascii=False)
    if not desktop.is_dir():
        return json.dumps({"error": f"Desktop path is not a directory: {desktop}"}, ensure_ascii=False)

    results: list[dict[str, object]] = []
    undo_moves: list[dict[str, str]] = []
    for entry in desktop.iterdir():
        if not entry.is_file():
            continue
        category = _get_category(entry)
        target_dir = desktop / category
        try:
            target_dir.mkdir(exist_ok=True)
            target = target_dir / entry.name
            # Handle name collision
            counter = 1
            stem = target.stem
            suffix = target.suffix
            while target.exists():
                target = target_dir / f"{stem}_{counter}{suffix}"
                counter += 1
            shutil.move(str(entry), str(target))
            results.append({"source": str(entry), "destination": str(target), "category": category, "status": "moved"})
            undo_moves.append({"source": str(entry), "destination": str(target)})
        except Exception as exc:
            results.append({"source": str(entry), "status": "error", "reason": str(exc)})

    return json.dumps({"desktop": str(desktop), "moved": len(results), "results": results, "undo_data": {"tool": "organize_desktop", "moves": undo_moves}}, ensure_ascii=False, default=str)


@mcp.tool()
def sort_files_by_date(directory_path: str) -> str:
    """Organize files into YYYY-MM subfolders based on modification time.

    Args:
        directory_path: Absolute or relative path to the directory to organize.
    """
    directory = _resolve_path(directory_path)
    if not directory.exists():
        return json.dumps({"error": f"Path does not exist: {directory_path}"}, ensure_ascii=False)
    if not directory.is_dir():
        return json.dumps({"error": f"Path is not a directory: {directory_path}"}, ensure_ascii=False)

    results: list[dict[str, object]] = []
    undo_moves: list[dict[str, str]] = []
    for entry in directory.iterdir():
        if not entry.is_file():
            continue
        try:
            mtime = datetime.fromtimestamp(entry.stat().st_mtime, tz=timezone.utc)
            subfolder_name = mtime.strftime("%Y-%m")
            target_dir = directory / subfolder_name
            target_dir.mkdir(exist_ok=True)
            target = target_dir / entry.name
            # Handle name collision
            counter = 1
            stem = target.stem
            suffix = target.suffix
            while target.exists():
                target = target_dir / f"{stem}_{counter}{suffix}"
                counter += 1
            shutil.move(str(entry), str(target))
            results.append({"source": str(entry), "destination": str(target), "month": subfolder_name, "status": "moved"})
            undo_moves.append({"source": str(entry), "destination": str(target)})
        except Exception as exc:
            results.append({"source": str(entry), "status": "error", "reason": str(exc)})

    return json.dumps({"directory": str(directory), "moved": len(results), "results": results, "undo_data": {"tool": "sort_files_by_date", "moves": undo_moves}}, ensure_ascii=False, default=str)


if __name__ == "__main__":
    mcp.run(transport="stdio")
