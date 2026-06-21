"""Pydantic models for the ``graph-web.json`` manifest.

The manifest is the *authoritative* contract between a target LangGraph project
and graph-web. It declares everything graph-web needs to load, run, and mock a
graph in-process. See ``docs`` / the example manifest for a filled-in sample.

The models are split across submodules by domain; this package re-exports them
so ``from graphweb.manifest.schema import Manifest`` keeps working.
"""

from .external import ExternalMatch, ExternalMock
from .fields import ContextField, FieldType, Inject, StateDecl, StateField
from .graph import GraphDecl
from .manifest import Manifest, PythonDecl, UiDecl
from .tools import MockMatch, ToolArg, ToolDecl, ToolMockSpec

__all__ = [
    "ContextField",
    "ExternalMatch",
    "ExternalMock",
    "FieldType",
    "GraphDecl",
    "Inject",
    "Manifest",
    "MockMatch",
    "PythonDecl",
    "StateDecl",
    "StateField",
    "ToolArg",
    "ToolDecl",
    "ToolMockSpec",
    "UiDecl",
]
