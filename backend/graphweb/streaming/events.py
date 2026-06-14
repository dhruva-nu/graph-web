"""The unified Event model + helpers to serialise LangChain messages.

One envelope, discriminated by ``type``. Modeled on ADK's event stream but for
LangGraph. Built as plain dicts for cheap JSON serialisation over SSE.
"""

from __future__ import annotations

import itertools
import time
from typing import Any

_seq = itertools.count()


def next_seq() -> int:
    return next(_seq)


def _msg_role(message: Any) -> str:
    t = getattr(message, "type", None)
    return {
        "human": "human",
        "ai": "ai",
        "tool": "tool",
        "system": "system",
        "AIMessageChunk": "ai",
    }.get(t, t or "ai")


def flatten_content(content: Any) -> str:
    """Collapse multi-part LLM content (Gemini lists) into one string."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for part in content:
            if isinstance(part, str):
                parts.append(part)
            elif isinstance(part, dict) and part.get("type") == "text":
                parts.append(part.get("text") or "")
        return "".join(parts)
    return str(content) if content is not None else ""


def serialise_message(message: Any) -> dict[str, Any]:
    role = _msg_role(message)
    out: dict[str, Any] = {
        "role": role,
        "content": flatten_content(getattr(message, "content", "")),
        "id": getattr(message, "id", None),
    }
    tool_calls = getattr(message, "tool_calls", None)
    if tool_calls:
        out["tool_calls"] = [
            {"name": tc.get("name"), "args": tc.get("args"), "id": tc.get("id")}
            for tc in tool_calls
        ]
    if role == "tool":
        out["tool_call_id"] = getattr(message, "tool_call_id", None)
        out["name"] = getattr(message, "name", None)
    return out


def event(
    type: str,
    *,
    thread_id: str,
    run_id: str,
    author: str | None = None,
    **extra: Any,
) -> dict[str, Any]:
    base: dict[str, Any] = {
        "type": type,
        "seq": next_seq(),
        "ts": time.time(),
        "thread_id": thread_id,
        "run_id": run_id,
        "author": author,
    }
    base.update({k: v for k, v in extra.items() if v is not None})
    return base


def make_serialisable(value: Any) -> Any:
    """Best-effort JSON-safe rendering of arbitrary state values."""
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    if isinstance(value, dict):
        return {str(k): make_serialisable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        # A list of messages?
        if value and hasattr(value[0], "type") and hasattr(value[0], "content"):
            return [serialise_message(m) for m in value]
        return [make_serialisable(v) for v in value]
    if hasattr(value, "type") and hasattr(value, "content"):  # a message
        return serialise_message(value)
    return str(value)
