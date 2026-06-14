"""Manifest + env endpoints."""

from __future__ import annotations

import fnmatch

from fastapi import APIRouter

from ..project.registry import registry

router = APIRouter()


@router.get("/manifest")
def get_manifest():
    lm = registry.lm
    m = lm.manifest
    return {
        "name": m.name,
        "version": m.version,
        "manifest_path": str(lm.path),
        "project_root": str(lm.project_root),
        "ui": m.ui.model_dump(),
        "graphs": [
            {"id": g.id, "title": g.display_title} for g in m.graphs
        ],
    }


def _redacted(key: str, value: str, patterns: list[str]) -> str:
    for pat in patterns:
        if fnmatch.fnmatch(key, pat):
            return "••••••••"
    # Heuristic: redact long opaque values too.
    if len(value) > 40 and " " not in value:
        return value[:4] + "…" + value[-2:]
    return value


@router.get("/env")
def get_env():
    lm = registry.lm
    patterns = lm.manifest.redact_env
    keys = registry.env_keys
    return {
        "env_file": str(lm.resolve(lm.manifest.env_file)) if lm.manifest.env_file else None,
        "vars": [
            {"key": k, "value": _redacted(k, v, patterns), "redacted": v != _redacted(k, v, patterns)}
            for k, v in sorted(keys.items())
        ],
        "required_env": lm.manifest.required_env,
        "missing": [k for k in lm.manifest.required_env if k not in keys],
    }
