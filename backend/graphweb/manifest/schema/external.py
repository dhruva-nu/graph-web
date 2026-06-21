"""External (DB / HTTP / anything) mock declarations."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class ExternalMatch(BaseModel):
    """Arg-matched external return. ``when_args`` matches positional args.

    Under a method patch the bound ``self`` is the first positional arg and is
    ignored during matching (see ``external.make_table``).
    """

    when_args: list[Any] = Field(default_factory=list)
    when_kwargs: dict[str, Any] = Field(default_factory=dict)
    return_: Any = Field(default=None, alias="return")

    model_config = {"populate_by_name": True}


class ExternalMock(BaseModel):
    id: str
    # Dotted path passed to unittest.mock.patch, e.g.
    # "app.repositories.course_repository.CourseRepository.get_by_id".
    patch: str
    mode: Literal["return", "side_effect_table", "block", "dummy"] = "return"
    # How to materialise the returned value:
    #   object -> recursive SimpleNamespace (attribute access: course.info)
    #   dict / scalar -> as-is
    shape: Literal["object", "dict", "scalar"] = "object"
    is_async: bool = False
    return_: Any = Field(default=None, alias="return")
    matches: list[ExternalMatch] = Field(default_factory=list)
    default: dict[str, Any] | None = None  # {"return": ...}
    # For mode == "block": what to do when the target is called.
    policy: Literal["error", "noop", "allow"] = "error"
    description: str | None = None

    model_config = {"populate_by_name": True}
