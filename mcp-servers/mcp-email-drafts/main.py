#!/usr/bin/env python3
"""Email Drafts & SMTP MCP Server"""

import json
import smtplib
from email.mime.text import MIMEText

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("email-drafts")


@mcp.tool()
def draft_email(to: str, subject: str, body: str) -> str:
    """Draft an email (does not send)."""
    return f"Mock: drafted email to {to}"


@mcp.tool()
def list_drafts() -> str:
    """List saved drafts."""
    return "Mock: 0 drafts"


@mcp.tool()
def send_email(
    host: str,
    port: int,
    username: str,
    password: str,
    to: str,
    subject: str,
    body: str,
    use_tls: bool = True,
) -> str:
    """Send an email via SMTP.

    Args:
        host: SMTP server hostname (e.g. smtp.gmail.com).
        port: SMTP server port (e.g. 587).
        username: SMTP login username.
        password: SMTP login password or app-specific password.
        to: Recipient email address.
        subject: Email subject line.
        body: Plain-text email body.
        use_tls: Whether to start TLS after connecting (default True).
    """
    try:
        msg = MIMEText(body, "plain", "utf-8")
        msg["Subject"] = subject
        msg["From"] = username
        msg["To"] = to

        with smtplib.SMTP(host, port, timeout=30) as server:
            if use_tls:
                server.starttls()
            server.login(username, password)
            server.send_message(msg)

        return json.dumps(
            {"status": "sent", "to": to, "subject": subject, "host": host},
            ensure_ascii=False,
        )
    except smtplib.SMTPException as exc:
        return json.dumps({"error": f"SMTP error: {exc}"}, ensure_ascii=False)
    except Exception as exc:
        return json.dumps({"error": str(exc)}, ensure_ascii=False)


if __name__ == "__main__":
    mcp.run(transport="stdio")
