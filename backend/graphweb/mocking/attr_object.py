"""Turn a mock value into something nodes can use.

Many nodes do attribute access on returned domain objects (``course.info``,
``lesson.name``, ``user.email``). A plain dict would raise AttributeError, so
when ``shape == "object"`` we wrap dicts (recursively) in a namespace that also
supports ``["key"]`` and ``.get(...)`` for good measure.
"""

from __future__ import annotations

from typing import Any


class AttrObject:
    """A recursive attribute/dict hybrid view over a mapping."""

    def __init__(self, data: dict[str, Any]):
        object.__setattr__(self, "_data", data)

    def __getattr__(self, name: str) -> Any:
        data = object.__getattribute__(self, "_data")
        if name in data:
            return wrap_object(data[name])
        raise AttributeError(name)

    def __getitem__(self, key: str) -> Any:
        return wrap_object(object.__getattribute__(self, "_data")[key])

    def get(self, key: str, default: Any = None) -> Any:
        data = object.__getattribute__(self, "_data")
        return wrap_object(data[key]) if key in data else default

    def __repr__(self) -> str:
        return f"AttrObject({object.__getattribute__(self, '_data')!r})"


def wrap_object(value: Any) -> Any:
    if isinstance(value, dict):
        return AttrObject(value)
    if isinstance(value, list):
        return [wrap_object(v) for v in value]
    return value


def materialise(value: Any, shape: str) -> Any:
    if value is None:
        return None
    if shape == "object":
        return wrap_object(value)
    return value
