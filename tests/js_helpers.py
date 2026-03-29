from __future__ import annotations

import json
from pathlib import Path

import quickjs


ROOT = Path(__file__).resolve().parents[1]


def context_with_files(*relative_paths: str) -> quickjs.Context:
    context = quickjs.Context()
    for relative_path in relative_paths:
        source = (ROOT / relative_path).read_text(encoding="utf-8")
        context.eval(source)
    return context


def eval_json(context: quickjs.Context, expression: str):
    return json.loads(context.eval(f"JSON.stringify({expression})"))
