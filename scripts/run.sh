#!/usr/bin/env bash
# graph-web — one command to build the frontend and serve everything.
#
# Usage:
#   scripts/run.sh /path/to/your-project/graph-web.json          # build FE, BE serves it (one process, one port)
#   scripts/run.sh /path/to/your-project/graph-web.json --dev     # HMR: vite + backend concurrently
#
# The backend imports your graph in-process, so it runs inside your project's
# virtualenv (read from the manifest's python.venv). The frontend is built with
# bun and served by the backend at the same origin — no CORS, no separate port.
set -euo pipefail

MANIFEST=""
DEV=0
for arg in "$@"; do
  case "$arg" in
    --dev) DEV=1 ;;
    *) MANIFEST="$arg" ;;
  esac
done

if [[ -z "$MANIFEST" ]]; then
  echo "usage: $0 /path/to/graph-web.json [--dev]" >&2
  exit 1
fi
MANIFEST="$(realpath "$MANIFEST")"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
PORT="${GRAPHWEB_PORT:-8777}"

command -v bun >/dev/null 2>&1 || { echo "[graph-web] 'bun' not found on PATH." >&2; exit 1; }

# Resolve the project venv python (python.venv in the manifest), else system python3.
MANIFEST_DIR="$(dirname "$MANIFEST")"
VENV_REL="$(python3 -c "import json;print(json.load(open('$MANIFEST')).get('python',{}).get('venv',''))" 2>/dev/null || true)"
PY="python3"
if [[ -n "$VENV_REL" && -x "$MANIFEST_DIR/$VENV_REL/bin/python" ]]; then
  PY="$MANIFEST_DIR/$VENV_REL/bin/python"
fi
echo "[graph-web] interpreter: $PY"

# Ensure graph-web's backend deps exist in that interpreter.
"$PY" - <<'PYCHECK' 2>/dev/null || { echo "[graph-web] installing backend deps…"; "$PY" -m pip install -q fastapi "uvicorn[standard]" python-dotenv; }
import fastapi, uvicorn, dotenv  # noqa
PYCHECK

# Frontend deps (bun).
if [[ ! -d "$FRONTEND/node_modules" ]]; then
  echo "[graph-web] bun install…"
  (cd "$FRONTEND" && bun install)
fi

export GRAPHWEB_MANIFEST="$MANIFEST"
export GRAPHWEB_PORT="$PORT"
export PYTHONPATH="$BACKEND${PYTHONPATH:+:$PYTHONPATH}"

if [[ "$DEV" == "1" ]]; then
  # ── Dev mode: vite (HMR) + backend, concurrently. Vite proxies /api → backend.
  echo "[graph-web] dev mode — UI http://localhost:5173  ·  API http://127.0.0.1:$PORT"
  "$PY" -m uvicorn graphweb.main:app --host 127.0.0.1 --port "$PORT" --reload &
  BE_PID=$!
  trap 'kill $BE_PID 2>/dev/null || true' EXIT INT TERM
  (cd "$FRONTEND" && exec bun run dev)
else
  # ── Serve mode: build the FE with bun, backend serves it on one port.
  echo "[graph-web] building frontend (bun run build)…"
  (cd "$FRONTEND" && bun run build)
  export GRAPHWEB_FRONTEND_DIST="$FRONTEND/dist"
  echo "[graph-web] ready → http://127.0.0.1:$PORT"
  exec "$PY" -m uvicorn graphweb.main:app --host 127.0.0.1 --port "$PORT"
fi
