"""Tool declarations and their mock specifications."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

from .fields import FieldType


class ToolArg(BaseModel):
    name: str
    type: FieldType = "string"
    description: str | None = None


class MockMatch(BaseModel):
    """An arg-matched mock return. ``when`` is a subset-match against kwargs."""

    when: dict[str, Any] = Field(default_factory=dict)
    return_: Any = Field(default=None, alias="return")

    model_config = {"populate_by_name": True}


class ToolMockSpec(BaseModel):
    mode: Literal["static", "arg_matched", "passthrough"] = "static"
    default: Any = None
    matches: list[MockMatch] = Field(default_factory=list)


class ToolDecl(BaseModel):
    name: str
    # Dotted import of the live tool object, e.g. "pkg.mod:get_user_profile".
    import_: str = Field(alias="import")
    signature: list[ToolArg] = Field(default_factory=list)
    returns: str | None = None
    title: str | None = None
    description: str | None = None
    mock: ToolMockSpec = Field(default_factory=ToolMockSpec)

    model_config = {"populate_by_name": True}
