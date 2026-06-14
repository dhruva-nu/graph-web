"""Load and validate a ``graph-web.json`` manifest, resolving paths."""

from __future__ import annotations

import json
from pathlib import Path

from .schema import Manifest


class ManifestError(Exception):
    pass


class LoadedManifest:
    """A validated manifest plus the directory it was loaded from."""

    def __init__(self, manifest: Manifest, manifest_path: Path):
        self.manifest = manifest
        self.path = manifest_path
        self.root = manifest_path.parent

    def resolve(self, rel: str | None) -> Path | None:
        """Resolve a manifest-relative path to an absolute path."""
        if rel is None:
            return None
        p = Path(rel)
        return p if p.is_absolute() else (self.root / p).resolve()

    @property
    def project_root(self) -> Path:
        resolved = self.resolve(self.manifest.python.project_root)
        assert resolved is not None
        return resolved


def load_manifest(path: str | Path) -> LoadedManifest:
    p = Path(path).expanduser().resolve()
    if not p.exists():
        raise ManifestError(f"Manifest not found: {p}")
    try:
        raw = json.loads(p.read_text())
    except json.JSONDecodeError as e:
        raise ManifestError(f"Invalid JSON in {p}: {e}") from e
    try:
        manifest = Manifest.model_validate(raw)
    except Exception as e:  # pydantic ValidationError
        raise ManifestError(f"Manifest failed validation: {e}") from e
    return LoadedManifest(manifest, p)
