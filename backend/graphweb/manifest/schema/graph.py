"""A single graph declaration: entrypoint plus its state, context, and mocks."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

from .external import ExternalMock
from .fields import ContextField, StateDecl
from .tools import ToolDecl


class GraphDecl(BaseModel):
    id: str
    title: str | None = None
    # "file.py:symbol" relative to python.project_root.
    entrypoint: str
    kind: Literal["factory", "compiled"] = "factory"
    factory_args: dict[str, Any] | None = None
    checkpointer: Literal["reuse", "inject"] = "reuse"
    undeclared_call_policy: Literal["error", "allow"] = "allow"

    state: StateDecl = Field(default_factory=StateDecl)
    context: list[ContextField] = Field(default_factory=list)
    tools: list[ToolDecl] = Field(default_factory=list)
    external_mocks: list[ExternalMock] = Field(default_factory=list)

    @property
    def display_title(self) -> str:
        return self.title or self.id
