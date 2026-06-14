"""Pydantic models for the ``graph-web.json`` manifest.

The manifest is the *authoritative* contract between a target LangGraph project
and graph-web. It declares everything graph-web needs to load, run, and mock a
graph in-process. See ``docs`` / the example manifest for a filled-in sample.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

# --------------------------------------------------------------------------- #
# Field declarations (state + context)
# --------------------------------------------------------------------------- #

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


# --------------------------------------------------------------------------- #
# Tool mocks
# --------------------------------------------------------------------------- #


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


# --------------------------------------------------------------------------- #
# External (DB / HTTP / anything) mocks
# --------------------------------------------------------------------------- #


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


# --------------------------------------------------------------------------- #
# Graphs
# --------------------------------------------------------------------------- #


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


# --------------------------------------------------------------------------- #
# Top level
# --------------------------------------------------------------------------- #


class PythonDecl(BaseModel):
    project_root: str = "."
    venv: str | None = None
    extra_sys_path: list[str] = Field(default_factory=list)


class UiDecl(BaseModel):
    default_graph: str | None = None
    theme: str = "graphite"


class Manifest(BaseModel):
    version: str = "1"
    name: str = "Untitled LangGraph project"
    python: PythonDecl = Field(default_factory=PythonDecl)
    env_file: str | None = None
    required_env: list[str] = Field(default_factory=list)
    redact_env: list[str] = Field(
        default_factory=lambda: ["*_KEY", "*_SECRET", "*_PASSWORD", "*_TOKEN"]
    )
    graphs: list[GraphDecl] = Field(default_factory=list)
    ui: UiDecl = Field(default_factory=UiDecl)

    def graph(self, graph_id: str) -> GraphDecl:
        for g in self.graphs:
            if g.id == graph_id:
                return g
        raise KeyError(f"No graph with id '{graph_id}' in manifest.")
