"""Import a target project's compiled LangGraph graph in-process."""

from __future__ import annotations

import importlib
import sys
import traceback
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from ..manifest.loader import LoadedManifest
from ..manifest.schema import GraphDecl
from .env_loader import load_env


class ImportFailure(Exception):
    def __init__(self, message: str, tb: str | None = None):
        super().__init__(message)
        self.tb = tb


@dataclass
class LoadedGraph:
    id: str
    compiled: Any  # CompiledStateGraph
    decl: GraphDecl


def _split_entrypoint(entrypoint: str) -> tuple[str, str]:
    if ":" not in entrypoint:
        raise ImportFailure(
            f"entrypoint '{entrypoint}' must be of the form 'file.py:symbol'"
        )
    module_part, symbol = entrypoint.rsplit(":", 1)
    module_name = module_part.removesuffix(".py").replace("/", ".").replace("\\", ".")
    return module_name, symbol


def _is_compiled(obj: Any) -> bool:
    try:
        from langgraph.graph.state import CompiledStateGraph

        if isinstance(obj, CompiledStateGraph):
            return True
    except Exception:
        pass
    # Fallback heuristic: a compiled graph exposes astream / get_graph.
    return hasattr(obj, "astream") and hasattr(obj, "get_graph")


_ENV_LOADED = False


def ensure_env(lm: LoadedManifest) -> dict[str, str]:
    """Load the project's .env and configure sys.path. Idempotent per process."""
    global _ENV_LOADED
    loaded = load_env(lm.resolve(lm.manifest.env_file))
    root = str(lm.project_root)
    if root not in sys.path:
        sys.path.insert(0, root)
    for extra in lm.manifest.python.extra_sys_path:
        p = lm.resolve(extra)
        if p and str(p) not in sys.path:
            sys.path.insert(0, str(p))
    _ENV_LOADED = True
    return loaded


def load_graph(lm: LoadedManifest, graph_id: str) -> LoadedGraph:
    decl = lm.manifest.graph(graph_id)
    ensure_env(lm)

    module_name, symbol = _split_entrypoint(decl.entrypoint)
    try:
        mod = importlib.import_module(module_name)
    except Exception as e:
        raise ImportFailure(
            f"Failed to import module '{module_name}': {e}", traceback.format_exc()
        ) from e

    try:
        obj = getattr(mod, symbol)
    except AttributeError as e:
        raise ImportFailure(
            f"Module '{module_name}' has no symbol '{symbol}'", traceback.format_exc()
        ) from e

    try:
        if decl.kind == "factory" or (callable(obj) and not _is_compiled(obj)):
            if decl.factory_args:
                compiled = obj(**decl.factory_args)
            else:
                compiled = obj()
        else:
            compiled = obj
    except Exception as e:
        raise ImportFailure(
            f"Failed to build graph from '{decl.entrypoint}': {e}",
            traceback.format_exc(),
        ) from e

    if not _is_compiled(compiled):
        raise ImportFailure(
            f"'{decl.entrypoint}' did not resolve to a compiled LangGraph graph "
            f"(got {type(compiled).__name__})."
        )

    return LoadedGraph(id=graph_id, compiled=compiled, decl=decl)
