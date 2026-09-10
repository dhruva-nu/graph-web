"""State and context field declarations surfaced in the inspector."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

FieldType = Literal["string", "integer", "number", "boolean", "json"]


class StateField(BaseModel):
    """A single field of the graph's State schema, surfaced in the inspector."""

    name: str
    type: FieldType = "string"
    default: Any = None
    editable: bool = True
    # Whether this field is seeded into the graph input on a fresh run.
    seed: bool = False
    nullable: bool = False
    title: str | None = None
    description: str | None = None


class StateDecl(BaseModel):
    # The channel that carries chat messages (LangGraph ``add_messages`` reducer).
    messages_key: str = "messages"
    fields: list[StateField] = Field(default_factory=list)


class Inject(BaseModel):
    """Where a context value is injected at run time.

    - ``configurable``: into ``config["configurable"][key]``
    - ``context``: into the ``context=`` runtime arg (LangGraph >=0.6)
    - ``contextvar``: ``ContextVar.set(value)`` for the var at ``import`` ("mod:var")
    """

    target: Literal["configurable", "context", "contextvar"]
    key: str | None = None
    import_: str | None = Field(default=None, alias="import")

    model_config = {"populate_by_name": True}


class ContextField(BaseModel):
    name: str
    type: FieldType = "string"
    default: Any = None
    editable: bool = True
    title: str | None = None
    description: str | None = None
    inject: list[Inject] = Field(default_factory=list)
