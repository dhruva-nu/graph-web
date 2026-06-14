"""Build unittest.mock patches for declared external (DB / HTTP) calls."""

from __future__ import annotations

import importlib
from contextlib import contextmanager
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

from ..manifest.schema import ExternalMock
from .attr_object import materialise


class UndeclaredExternalCall(Exception):
    pass


def _match_table(m: ExternalMock):
    """Return a callable that arg-matches positional/keyword args.

    Under a method patch the bound ``self`` is the first positional arg, which we
    ignore by comparing ``when_args`` against the *tail* of the positional args.
    """

    def resolve(*args: Any, **kwargs: Any) -> Any:
        for match in m.matches:
            want = match.when_args
            tail = list(args)[-len(want):] if want else []
            if want and tail != want:
                continue
            if match.when_kwargs and any(
                kwargs.get(k) != v for k, v in match.when_kwargs.items()
            ):
                continue
            return materialise(match.return_, m.shape)
        if m.default is not None:
            return materialise(m.default.get("return"), m.shape)
        return None

    return resolve


def _blocker(m: ExternalMock):
    def block(*args: Any, **kwargs: Any) -> Any:
        if m.policy == "noop":
            return MagicMock()
        raise UndeclaredExternalCall(
            f"External call '{m.patch}' was invoked but is blocked by the manifest."
        )

    return block


@contextmanager
def build_patch(m: ExternalMock):
    """Yield an active ``patch`` for one external mock declaration."""
    if m.mode == "dummy":
        # e.g. SessionLocal() -> a harmless object with .close()/context support.
        dummy = MagicMock(name=f"dummy::{m.id}")
        with patch(m.patch, return_value=dummy):
            yield
        return

    if m.mode == "block":
        with patch(m.patch, side_effect=_blocker(m)):
            yield
        return

    if m.mode == "return":
        value = materialise(m.return_, m.shape)
        if m.is_async:
            with patch(m.patch, new=AsyncMock(return_value=value)):
                yield
        else:
            with patch(m.patch, return_value=value):
                yield
        return

    # side_effect_table
    table = _match_table(m)
    if m.is_async:
        async def aresolve(*a: Any, **k: Any) -> Any:
            return table(*a, **k)

        with patch(m.patch, new=AsyncMock(side_effect=aresolve)):
            yield
    else:
        with patch(m.patch, side_effect=table):
            yield
