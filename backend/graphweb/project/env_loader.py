"""Load the target project's .env into os.environ BEFORE importing it.

This is critical: many projects (e.g. Hannibal's ``app.core.config``) read env
vars and freeze a Settings object at *import time*. If we import the graph
module before populating ``os.environ``, the project sees missing/stale keys.
"""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import dotenv_values


def load_env(env_file: Path | None) -> dict[str, str]:
    """Load ``env_file`` into ``os.environ`` (override=True). Returns the keys
    loaded (values included, for redaction the caller masks them)."""
    if env_file is None:
        return {}
    if not env_file.exists():
        return {}
    values = dotenv_values(env_file)
    loaded: dict[str, str] = {}
    for key, val in values.items():
        if val is None:
            continue
        os.environ[key] = val
        loaded[key] = val
    return loaded
