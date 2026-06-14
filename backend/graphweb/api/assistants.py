"""Assistant (graph) endpoints: list, schemas (drives UI forms), topology."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..project.importer import ImportFailure
from ..project.registry import registry

router = APIRouter()


@router.get("/assistants")
def list_assistants():
    m = registry.lm.manifest
    return [
        {
            "id": g.id,
            "title": g.display_title,
            "kind": g.kind,
            "entrypoint": g.entrypoint,
        }
        for g in m.graphs
    ]


@router.get("/assistants/{graph_id}/schemas")
def get_schemas(graph_id: str):
    """The manifest declarations that drive the UI forms."""
    try:
        decl = registry.lm.manifest.graph(graph_id)
    except KeyError:
        raise HTTPException(404, f"No graph '{graph_id}'")
    return {
        "id": decl.id,
        "title": decl.display_title,
        "messages_key": decl.state.messages_key,
        "state_fields": [f.model_dump() for f in decl.state.fields],
        "context_fields": [
            {**f.model_dump(by_alias=True)} for f in decl.context
        ],
        "tools": [
            {
                "name": t.name,
                "title": t.title or t.name,
                "description": t.description,
                "signature": [a.model_dump() for a in t.signature],
                "returns": t.returns,
                "mock": t.mock.model_dump(by_alias=True),
            }
            for t in decl.tools
        ],
        "external_mocks": [
            {"id": m.id, "patch": m.patch, "mode": m.mode, "description": m.description}
            for m in decl.external_mocks
        ],
    }


def _topology(compiled) -> dict:
    g = compiled.get_graph()
    nodes = []
    for node_id, node in g.nodes.items():
        nodes.append({"id": node_id, "label": getattr(node, "name", node_id) or node_id})
    edges = []
    for e in g.edges:
        edges.append(
            {
                "source": e.source,
                "target": e.target,
                "conditional": bool(getattr(e, "conditional", False)),
                "label": getattr(e, "data", None),
            }
        )
    return {"nodes": nodes, "edges": edges}


@router.get("/assistants/{graph_id}/graph")
def get_graph_topology(graph_id: str):
    try:
        loaded = registry.get_graph(graph_id)
    except ImportFailure as e:
        raise HTTPException(500, detail={"message": str(e), "traceback": e.tb})
    except KeyError:
        raise HTTPException(404, f"No graph '{graph_id}'")
    try:
        return _topology(loaded.compiled)
    except Exception as e:
        raise HTTPException(500, f"Could not build topology: {e}")
