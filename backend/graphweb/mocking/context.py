"""Inject mocked context values into the run.

Three injection targets, declared per context field in the manifest:
  - configurable -> RunnableConfig["configurable"][key]
  - context      -> the context= runtime arg (LangGraph >= 0.6)
  - contextvar   -> ContextVar(import="mod:var").set(value)

ContextVars MUST be set inside the same coroutine frame that calls astream so
node tasks inherit them (copy-on-task-creation). See run_context.py.
"""

from __future__ import annotations

import importlib
from contextvars import Token
from typing import Any

from ..manifest.schema import ContextField, GraphDecl


def _import_var(dotted: str):
    mod_name, sym = dotted.rsplit(":", 1)
    return getattr(importlib.import_module(mod_name), sym)


def set_contextvars(
    fields: list[ContextField], values: dict[str, Any]
) -> list[tuple[Any, Token]]:
    """Apply ``contextvar`` injections; return (var, token) pairs to reset."""
    tokens: list[tuple[Any, Token]] = []
    for field in fields:
        if field.name not in values:
            continue
        val = values[field.name]
        for inj in field.inject:
            if inj.target == "contextvar" and inj.import_:
                var = _import_var(inj.import_)
                tokens.append((var, var.set(val)))
    return tokens


def reset_contextvars(tokens: list[tuple[Any, Token]]) -> None:
    for var, token in reversed(tokens):
        try:
            var.reset(token)
        except Exception:
            pass


def build_config(
    decl: GraphDecl, thread_id: str, values: dict[str, Any]
) -> dict[str, Any]:
    """Build the RunnableConfig: thread_id + configurable injections."""
    configurable: dict[str, Any] = {"thread_id": thread_id}
    for field in decl.context:
        if field.name not in values:
            continue
        val = values[field.name]
        for inj in field.inject:
            if inj.target == "configurable":
                configurable[inj.key or field.name] = val
    return {"configurable": configurable}


def build_context_arg(decl: GraphDecl, values: dict[str, Any]) -> dict[str, Any]:
    """Build the context= runtime arg (only fields with target 'context')."""
    ctx: dict[str, Any] = {}
    for field in decl.context:
        if field.name not in values:
            continue
        for inj in field.inject:
            if inj.target == "context":
                ctx[inj.key or field.name] = values[field.name]
    return ctx
