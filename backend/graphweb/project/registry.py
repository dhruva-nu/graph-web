"""Process-wide registry holding the loaded manifest and graphs (cached)."""

from __future__ import annotations

from pathlib import Path

from ..manifest.loader import LoadedManifest, load_manifest
from .env_loader import load_env
from .importer import LoadedGraph, ensure_env, load_graph


class Registry:
    def __init__(self) -> None:
        self._lm: LoadedManifest | None = None
        self._graphs: dict[str, LoadedGraph] = {}
        self._env_keys: dict[str, str] = {}

    def load_manifest(self, path: str | Path) -> LoadedManifest:
        self._lm = load_manifest(path)
        self._graphs.clear()
        # Populate env immediately so /env works and import-time settings see it.
        self._env_keys = ensure_env(self._lm)
        return self._lm

    @property
    def lm(self) -> LoadedManifest:
        if self._lm is None:
            raise RuntimeError("No manifest loaded. Set GRAPHWEB_MANIFEST.")
        return self._lm

    @property
    def env_keys(self) -> dict[str, str]:
        return self._env_keys

    def get_graph(self, graph_id: str) -> LoadedGraph:
        if graph_id not in self._graphs:
            self._graphs[graph_id] = load_graph(self.lm, graph_id)
        return self._graphs[graph_id]


registry = Registry()
