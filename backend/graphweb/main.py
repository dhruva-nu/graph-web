"""FastAPI application factory for graph-web."""

from __future__ import annotations

import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .api import assistants, manifest, runs, threads
from .project.registry import registry
from .settings import settings


def _resolve_frontend_dist() -> Path | None:
    """Locate the built SPA (frontend/dist)."""
    if settings.frontend_dist:
        p = Path(settings.frontend_dist)
        return p if p.exists() else None
    # Default: graph-web/frontend/dist relative to this package.
    default = Path(__file__).resolve().parents[2] / "frontend" / "dist"
    return default if default.exists() else None


def _mount_frontend(app: FastAPI) -> None:
    dist = _resolve_frontend_dist()
    if dist is None:
        print(
            "[graph-web] no built frontend found — run the frontend build "
            "(or use --dev for HMR). API still served at /api.",
            file=sys.stderr,
        )
        return
    assets = dist / "assets"
    if assets.exists():
        app.mount("/assets", StaticFiles(directory=str(assets)), name="assets")

    index = dist / "index.html"

    # SPA fallback: any non-/api GET returns index.html (client-side routing).
    @app.get("/{full_path:path}")
    def spa(full_path: str):
        candidate = dist / full_path
        if full_path and candidate.is_file():
            return FileResponse(str(candidate))
        return FileResponse(str(index))

    print(f"[graph-web] serving frontend from {dist}")


def create_app() -> FastAPI:
    app = FastAPI(title="graph-web", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_origins),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    if settings.manifest_path:
        try:
            lm = registry.load_manifest(settings.manifest_path)
            print(f"[graph-web] loaded manifest: {lm.manifest.name} ({lm.path})")
            print(f"[graph-web] project root: {lm.project_root}")
            print(f"[graph-web] graphs: {[g.id for g in lm.manifest.graphs]}")
        except Exception as e:  # noqa: BLE001
            print(f"[graph-web] FAILED to load manifest: {e}", file=sys.stderr)
    else:
        print("[graph-web] WARNING: GRAPHWEB_MANIFEST not set.", file=sys.stderr)

    app.include_router(manifest.router, prefix="/api")
    app.include_router(assistants.router, prefix="/api")
    app.include_router(threads.router, prefix="/api")
    app.include_router(runs.router, prefix="/api")

    @app.get("/api/health")
    def health():
        return {"ok": True, "manifest_loaded": registry._lm is not None}

    # Mount the SPA LAST so /api/* routes match first.
    _mount_frontend(app)

    return app


app = create_app()
