"""Per-run mocking orchestration.

Everything is applied per run, inside one ExitStack wrapping the astream call:
external/DB/HTTP patches, tool .func/.coroutine swaps, and ContextVar sets.
ContextVars are set inside this coroutine frame so node tasks inherit them.
"""

from __future__ import annotations

import contextlib
from dataclasses import dataclass, field
from typing import Any

from ..project.importer import LoadedGraph
from . import context as ctx
from .external import build_patch
from .tools import mocked_tool_names, patch_tool


@dataclass
class RunInput:
    thread_id: str
    context_values: dict[str, Any] = field(default_factory=dict)


@dataclass
class PreparedRun:
    config: dict[str, Any]
    context_arg: dict[str, Any]


@contextlib.contextmanager
def run_mocks(loaded: LoadedGraph, run_input: RunInput):
    """Apply all mocks for the duration of a run. Yields a PreparedRun."""
    decl = loaded.decl
    # Fresh per-run record of which tools were served from a mock.
    hits_token = mocked_tool_names.set(set())
    with contextlib.ExitStack() as stack:
        # (a) external / DB / HTTP patches
        for m in decl.external_mocks:
            stack.enter_context(build_patch(m))
        # (b) tool .func / .coroutine swaps
        for t in decl.tools:
            stack.enter_context(patch_tool(t))
        # (c) ContextVars — set in this frame so node tasks inherit them
        cv_tokens = ctx.set_contextvars(decl.context, run_input.context_values)
        try:
            yield PreparedRun(
                config=ctx.build_config(
                    decl, run_input.thread_id, run_input.context_values
                ),
                context_arg=ctx.build_context_arg(decl, run_input.context_values),
            )
        finally:
            ctx.reset_contextvars(cv_tokens)
    mocked_tool_names.reset(hits_token)
