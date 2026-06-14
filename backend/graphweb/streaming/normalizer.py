"""Normalise LangGraph astream output into the unified Event stream."""

from __future__ import annotations

from typing import Any, Iterable

from ..mocking.tools import mocked_tool_names
from .events import event, make_serialisable, serialise_message


class Normalizer:
    def __init__(self, thread_id: str, run_id: str, messages_key: str = "messages"):
        self.thread_id = thread_id
        self.run_id = run_id
        self.messages_key = messages_key
        # Track emitted message ids to avoid dupes across updates/values.
        self._seen_msg_ids: set[str] = set()

    def _ev(self, type: str, **extra: Any) -> dict[str, Any]:
        return event(type, thread_id=self.thread_id, run_id=self.run_id, **extra)

    def run_start(self) -> dict[str, Any]:
        return self._ev("run_start")

    def run_complete(self) -> dict[str, Any]:
        return self._ev("run_complete")

    def error(self, message: str, detail: str | None = None) -> dict[str, Any]:
        return self._ev("error", content=message, detail=detail)

    def normalize(self, mode: str, chunk: Any) -> Iterable[dict[str, Any]]:
        if mode == "messages":
            yield from self._messages(chunk)
        elif mode == "updates":
            yield from self._updates(chunk)
        elif mode == "values":
            yield from self._values(chunk)

    # ---- per-mode handlers ------------------------------------------------ #

    def _messages(self, chunk: Any):
        # chunk == (message_chunk, metadata)
        try:
            msg, meta = chunk
        except (TypeError, ValueError):
            return
        node = (meta or {}).get("langgraph_node")
        content = getattr(msg, "content", "")
        from .events import flatten_content

        text = flatten_content(content)
        if text:
            yield self._ev("message_delta", author=node, delta=text, role="ai")

    def _updates(self, chunk: Any):
        if not isinstance(chunk, dict):
            return
        for node, update in chunk.items():
            if node in ("__interrupt__",):
                continue
            delta = update if isinstance(update, dict) else {"_": update}
            # Surface any new messages as tool_call / tool_result / message events.
            msgs = delta.get(self.messages_key) if isinstance(delta, dict) else None
            if msgs:
                yield from self._emit_messages(node, msgs)
            state_delta = {
                k: make_serialisable(v)
                for k, v in (delta.items() if isinstance(delta, dict) else [])
                if k != self.messages_key
            }
            yield self._ev(
                "node_end",
                author=node,
                state_delta=state_delta or None,
            )

    def _emit_messages(self, node: str, msgs: Any):
        if not isinstance(msgs, (list, tuple)):
            msgs = [msgs]
        mocked = mocked_tool_names.get()
        for m in msgs:
            mid = getattr(m, "id", None)
            if mid and mid in self._seen_msg_ids:
                continue
            if mid:
                self._seen_msg_ids.add(mid)
            mtype = getattr(m, "type", None)
            if mtype == "tool":
                yield self._ev(
                    "tool_result",
                    author=node,
                    role="tool",
                    tool={
                        "name": getattr(m, "name", None),
                        "call_id": getattr(m, "tool_call_id", None),
                        "result": getattr(m, "content", None),
                        "mocked": getattr(m, "name", None) in mocked,
                    },
                )
            elif mtype in ("ai", "AIMessageChunk"):
                tcs = getattr(m, "tool_calls", None)
                if tcs:
                    for tc in tcs:
                        yield self._ev(
                            "tool_call",
                            author=node,
                            tool={
                                "name": tc.get("name"),
                                "args": tc.get("args"),
                                "call_id": tc.get("id"),
                            },
                        )
                yield self._ev(
                    "message", author=node, role="ai", message=serialise_message(m)
                )

    def _values(self, chunk: Any):
        if not isinstance(chunk, dict):
            return
        snapshot = {k: make_serialisable(v) for k, v in chunk.items()}
        yield self._ev("state_snapshot", state_snapshot=snapshot)
