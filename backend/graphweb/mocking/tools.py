"""Mock LangChain tool objects in place.

The tool objects exported by a project (e.g. ``all_tools``) are the *same*
objects ``ToolNode`` holds references to. So to mock a tool we patch its own
``.func`` / ``.coroutine`` attributes rather than rebuilding any list — then
``ToolNode`` invokes our mock with zero changes to the project.
"""

from __future__ import annotations

import importlib
from contextlib import ExitStack, contextmanager
from contextvars import ContextVar
from typing import Any
from unittest.mock import patch

from ..manifest.schema import ToolDecl, ToolMockSpec

# Records names of tools served from a mock during the current run, so the
# event normalizer can badge tool results as "MOCKED".
mocked_tool_names: ContextVar[set] = ContextVar("_gw_mocked_tools", default=set())


def _record_hit(name: str) -> None:
    current = mocked_tool_names.get()
    current.add(name)


def _resolve(spec: ToolMockSpec, kwargs: dict[str, Any]) -> Any:
    if spec.mode == "arg_matched":
        for match in spec.matches:
            if all(kwargs.get(k) == v for k, v in match.when.items()):
                return match.return_
        return spec.default
    # static
    return spec.default


def _import_tool(dotted: str):
    mod_name, sym = dotted.rsplit(":", 1)
    mod = importlib.import_module(mod_name)
    return getattr(mod, sym)


@contextmanager
def patch_tool(decl: ToolDecl):
    if decl.mock.mode == "passthrough":
        yield
        return

    tool_obj = _import_tool(decl.import_)

    def sync_mock(*args: Any, **kwargs: Any) -> Any:
        _record_hit(decl.name)
        return _resolve(decl.mock, kwargs)

    async def async_mock(*args: Any, **kwargs: Any) -> Any:
        _record_hit(decl.name)
        return _resolve(decl.mock, kwargs)

    with ExitStack() as stack:
        if hasattr(tool_obj, "func") and tool_obj.func is not None:
            stack.enter_context(patch.object(tool_obj, "func", sync_mock))
        if getattr(tool_obj, "coroutine", None) is not None:
            stack.enter_context(patch.object(tool_obj, "coroutine", async_mock))
        # If the tool only has func (sync), ToolNode runs it in a thread — fine.
        yield
