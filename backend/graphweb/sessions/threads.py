"""In-memory thread registry.

A "thread" is just an id passed to the graph's checkpointer via
config["configurable"]["thread_id"]. We track the list (and which graph each
belongs to) for the UI; the actual conversation state lives in the graph's
checkpointer.
"""

from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, field


@dataclass
class Thread:
    id: str
    graph_id: str
    created_at: float = field(default_factory=time.time)
    title: str | None = None


class ThreadStore:
    def __init__(self) -> None:
        self._threads: dict[str, Thread] = {}

    def create(self, graph_id: str, title: str | None = None) -> Thread:
        tid = uuid.uuid4().hex[:12]
        t = Thread(id=tid, graph_id=graph_id, title=title)
        self._threads[tid] = t
        return t

    def get(self, tid: str) -> Thread | None:
        return self._threads.get(tid)

    def list(self, graph_id: str | None = None) -> list[Thread]:
        items = list(self._threads.values())
        if graph_id:
            items = [t for t in items if t.graph_id == graph_id]
        return sorted(items, key=lambda t: t.created_at, reverse=True)


thread_store = ThreadStore()
