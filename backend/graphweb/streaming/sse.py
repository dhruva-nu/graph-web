"""Server-Sent Events encoding."""

from __future__ import annotations

import json
from typing import Any


def encode(data: dict[str, Any]) -> str:
    payload = json.dumps(data, default=str, ensure_ascii=False)
    return f"event: {data.get('type', 'message')}\ndata: {payload}\n\n"
