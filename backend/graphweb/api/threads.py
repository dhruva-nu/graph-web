"""Thread CRUD + state read/patch."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..project.registry import registry
from ..sessions.threads import thread_store
from ..streaming.events import make_serialisable

router = APIRouter()


class CreateThread(BaseModel):
    graph_id: str
    title: str | None = None


@router.post("/threads")
def create_thread(body: CreateThread):
    t = thread_store.create(body.graph_id, body.title)
    return {"id": t.id, "graph_id": t.graph_id, "created_at": t.created_at}


@router.get("/threads")
def list_threads(graph_id: str | None = None):
    return [
        {"id": t.id, "graph_id": t.graph_id, "created_at": t.created_at, "title": t.title}
        for t in thread_store.list(graph_id)
    ]


@router.get("/threads/{thread_id}/state")
def get_state(thread_id: str):
    t = thread_store.get(thread_id)
    if t is None:
        raise HTTPException(404, "No such thread")
    loaded = registry.get_graph(t.graph_id)
    config = {"configurable": {"thread_id": thread_id}}
    try:
        snap = loaded.compiled.get_state(config)
        values = make_serialisable(dict(snap.values)) if snap and snap.values else {}
        next_nodes = list(snap.next) if snap else []
    except Exception as e:
        raise HTTPException(500, f"Could not read state: {e}")
    return {"thread_id": thread_id, "values": values, "next": next_nodes}


class PatchState(BaseModel):
    values: dict


@router.post("/threads/{thread_id}/state")
def patch_state(thread_id: str, body: PatchState):
    t = thread_store.get(thread_id)
    if t is None:
        raise HTTPException(404, "No such thread")
    loaded = registry.get_graph(t.graph_id)
    config = {"configurable": {"thread_id": thread_id}}
    try:
        loaded.compiled.update_state(config, body.values)
    except Exception as e:
        raise HTTPException(500, f"Could not update state: {e}")
    return {"ok": True}
