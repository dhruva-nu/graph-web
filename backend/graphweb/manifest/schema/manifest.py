"""The top-level manifest model and its Python/UI sub-declarations."""

from __future__ import annotations

from pydantic import BaseModel, Field

from .graph import GraphDecl


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
