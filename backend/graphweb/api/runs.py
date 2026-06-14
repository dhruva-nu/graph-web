"""The run endpoint: stream a graph invocation as SSE."""

from __future__ import annotations

import traceback
import uuid

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ..mocking.run_context import RunInput, run_mocks
from ..project.registry import registry
from ..sessions.threads import thread_store
from ..streaming import sse
from ..streaming.normalizer import Normalizer

router = APIRouter()


class RunRequest(BaseModel):
    graph_id: str
    thread_id: str | None = None
    message: str | None = None
    # Mocked context values keyed by context field name.
    context_values: dict = {}
    # Seeded initial state values keyed by state field name.
    state_values: dict = {}


def _build_input(loaded, body: RunRequest) -> dict:
    from langchain_core.messages import HumanMessage

    decl = loaded.decl
    graph_input: dict = {}
    seedable = {f.name for f in decl.state.fields if f.seed}
    for name, val in body.state_values.items():
        if name in seedable:
            graph_input[name] = val
    if body.message:
        graph_input[decl.state.messages_key] = [HumanMessage(content=body.message)]
    return graph_input


@router.post("/threads/{thread_id}/runs/stream")
async def stream_run(thread_id: str, body: RunRequest):
    body.thread_id = thread_id
    if thread_store.get(thread_id) is None:
        # Auto-register an externally-minted thread id.
        t = thread_store.create(body.graph_id)
        thread_id = t.id
        body.thread_id = thread_id

    loaded = registry.get_graph(body.graph_id)
    run_id = uuid.uuid4().hex[:12]
    norm = Normalizer(thread_id, run_id, loaded.decl.state.messages_key)

    async def gen():
        yield sse.encode(norm.run_start())
        try:
            with run_mocks(loaded, RunInput(thread_id, body.context_values)) as prep:
                graph_input = _build_input(loaded, body)
                astream_kwargs = {
                    "config": prep.config,
                    "stream_mode": ["updates", "messages", "values"],
                }
                if prep.context_arg:
                    astream_kwargs["context"] = prep.context_arg
                async for mode, chunk in loaded.compiled.astream(
                    graph_input, **astream_kwargs
                ):
                    for ev in norm.normalize(mode, chunk):
                        yield sse.encode(ev)
        except Exception as e:
            yield sse.encode(norm.error(str(e), traceback.format_exc()))
        yield sse.encode(norm.run_complete())

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
