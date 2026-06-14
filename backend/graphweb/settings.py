"""graph-web's own runtime settings (NOT the target project's settings).

The manifest path is provided via the ``GRAPHWEB_MANIFEST`` environment
variable (an absolute path to a ``graph-web.json``).
"""

from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass
class Settings:
    manifest_path: str | None = None
    host: str = "127.0.0.1"
    port: int = 8777
    # Built frontend (frontend/dist). When present, the backend serves the SPA
    # so a single process serves both the API and the UI.
    frontend_dist: str | None = None
    cors_origins: tuple[str, ...] = (
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    )

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            manifest_path=os.environ.get("GRAPHWEB_MANIFEST"),
            host=os.environ.get("GRAPHWEB_HOST", "127.0.0.1"),
            port=int(os.environ.get("GRAPHWEB_PORT", "8777")),
            frontend_dist=os.environ.get("GRAPHWEB_FRONTEND_DIST"),
        )


settings = Settings.from_env()
