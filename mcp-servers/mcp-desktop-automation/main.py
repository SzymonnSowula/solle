#!/usr/bin/env python3
"""Desktop Automation MCP Server

Cross-platform desktop control via MCP stdio transport.
Primary target: Windows. Works on Linux/WSL (with display) and macOS.
"""

from __future__ import annotations

import base64
import io
import json
import os
import platform
import subprocess
import sys
import time
from pathlib import Path

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("desktop-automation")


def _run_platform(
    windows_cmd: list[str],
    linux_cmd: list[str] | None = None,
    macos_cmd: list[str] | None = None,
    shell: bool = False,
) -> tuple[int, str, str]:
    """Run a platform-specific subprocess command."""
    system = platform.system()
    if system == "Windows":
        cmd = windows_cmd
    elif system == "Darwin":
        cmd = macos_cmd if macos_cmd is not None else linux_cmd if linux_cmd is not None else windows_cmd
    else:  # Linux / WSL
        cmd = linux_cmd if linux_cmd is not None else windows_cmd

    if cmd is None:
        raise RuntimeError(f"No command defined for platform {system}")

    proc = subprocess.run(cmd, capture_output=True, text=True, shell=shell)
    return proc.returncode, proc.stdout, proc.stderr


@mcp.tool()
def take_screenshot() -> str:
    """Capture the entire primary screen and return a base64-encoded PNG image."""
    try:
        import mss
        from PIL import Image
    except ImportError as exc:
        return json.dumps({"error": f"Missing dependency: {exc}"}, ensure_ascii=False)

    try:
        with mss.mss() as sct:
            monitor = sct.monitors[1]  # primary monitor
            sct_img = sct.grab(monitor)
            img = Image.frombytes("RGB", sct_img.size, sct_img.bgra, "raw", "BGRX")
            buffer = io.BytesIO()
            img.save(buffer, format="PNG")
            b64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
            return json.dumps({"image_base64": b64, "format": "png"}, ensure_ascii=False)
    except Exception as exc:
        return json.dumps({"error": str(exc)}, ensure_ascii=False)


@mcp.tool()
def open_application(app_name: str) -> str:
    """Open an application by name.

    Args:
        app_name: The application name or executable path.
                On Windows you can pass e.g. "notepad", "calc", or a full path.
                On Linux/WSL use e.g. "firefox", "code".
                On macOS use e.g. "Safari".
    """
    system = platform.system()
    try:
        if system == "Windows":
            # os.startfile works for executables, documents, and URLs
            try:
                os.startfile(app_name)  # type: ignore[attr-defined]
            except AttributeError:
                # Fallback if somehow not on Windows
                subprocess.Popen(["cmd", "/c", "start", "", app_name], shell=False)
        elif system == "Darwin":
            subprocess.Popen(["open", "-a", app_name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        else:
            # Linux / WSL – prefer xdg-open for paths/URLs, otherwise try running directly
            if Path(app_name).exists() or app_name.startswith(("http://", "https://")):
                subprocess.Popen(["xdg-open", app_name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            else:
                subprocess.Popen([app_name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return json.dumps({"status": "opened", "app": app_name, "platform": system}, ensure_ascii=False)
    except Exception as exc:
        return json.dumps({"error": str(exc), "app": app_name, "platform": system}, ensure_ascii=False)


@mcp.tool()
def open_folder(folder_path: str) -> str:
    """Open a folder in the default file manager.

    Args:
        folder_path: Absolute path to the folder.
    """
    system = platform.system()
    path = Path(folder_path).expanduser().resolve()
    if not path.exists():
        return json.dumps({"error": f"Path does not exist: {folder_path}"}, ensure_ascii=False)
    if not path.is_dir():
        return json.dumps({"error": f"Path is not a directory: {folder_path}"}, ensure_ascii=False)

    try:
        if system == "Windows":
            os.startfile(str(path))  # type: ignore[attr-defined]
        elif system == "Darwin":
            subprocess.Popen(["open", str(path)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        else:
            subprocess.Popen(["xdg-open", str(path)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return json.dumps({"status": "opened", "folder": str(path), "platform": system}, ensure_ascii=False)
    except Exception as exc:
        return json.dumps({"error": str(exc), "folder": str(path), "platform": system}, ensure_ascii=False)


@mcp.tool()
def type_text(text: str, interval: float = 0.01) -> str:
    """Simulate typing text using the keyboard.

    Args:
        text: The text to type.
        interval: Delay between keystrokes in seconds (default 0.01).
    """
    try:
        from pynput.keyboard import Controller
    except ImportError as exc:
        return json.dumps({"error": f"Missing dependency: {exc}"}, ensure_ascii=False)

    try:
        controller = Controller()
        controller.type(text)
        return json.dumps({"status": "typed", "length": len(text)}, ensure_ascii=False)
    except Exception as exc:
        return json.dumps({"error": str(exc)}, ensure_ascii=False)


@mcp.tool()
def clipboard_read() -> str:
    """Read the current text content of the system clipboard."""
    try:
        import pyperclip
    except ImportError as exc:
        return json.dumps({"error": f"Missing dependency: {exc}"}, ensure_ascii=False)

    try:
        text = pyperclip.paste()
        return json.dumps({"text": text}, ensure_ascii=False)
    except Exception as exc:
        return json.dumps({"error": str(exc)}, ensure_ascii=False)


@mcp.tool()
def clipboard_write(text: str) -> str:
    """Write text to the system clipboard.

    Args:
        text: The text to copy to the clipboard.
    """
    try:
        import pyperclip
    except ImportError as exc:
        return json.dumps({"error": f"Missing dependency: {exc}"}, ensure_ascii=False)

    try:
        pyperclip.copy(text)
        return json.dumps({"status": "copied", "length": len(text)}, ensure_ascii=False)
    except Exception as exc:
        return json.dumps({"error": str(exc)}, ensure_ascii=False)


if __name__ == "__main__":
    mcp.run(transport="stdio")
