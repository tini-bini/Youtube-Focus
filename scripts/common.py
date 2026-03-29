from __future__ import annotations

import json
from pathlib import Path

import quickjs


ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "manifest.json"
SOURCE_DIRS = ("shared", "content", "popup", "settings", "scripts", "tests", "release")
MOJIBAKE_PATTERNS = ("\u00e2", "\u00f0", "\u00c3", "\ufffd")
SKIP_DIR_NAMES = {"__pycache__", ".pytest_cache", ".git", "dist"}
TEXT_SUFFIXES = {".css", ".html", ".js", ".json", ".md", ".py", ".txt", ".yml", ".yaml"}


def _token(*parts: str) -> str:
    return "".join(parts)


PLACEHOLDER_PATTERNS = (
    _token("[", "PRO", "JECT_NAME", "]"),
    _token("[", "TARGET", " USERS", "]"),
    _token("[", "FLOW", "_1", "]"),
    _token("[", "FLOW", "_2", "]"),
    _token("[", "FLOW", "_3", "]"),
    _token("[", "STACK"),
    _token("[", "TARGET", "]"),
    _token("[", "BRANCH", "_NAME", "]"),
    _token("[", "REMOTE", "_NAME", "]"),
    _token("[", "PAY", "PAL_ME_LINK_1", "]"),
    _token("[", "PAY", "PAL_ME_LINK_2", "]"),
)
TASK_NOTE_MARKERS = (
    _token("TO", "DO"),
    _token("FIX", "ME"),
)


def _is_tracked_text_file(path: Path) -> bool:
    if path.suffix.lower() not in TEXT_SUFFIXES:
        return False

    return not any(part in SKIP_DIR_NAMES for part in path.parts)


def iter_source_files() -> list[Path]:
    files: list[Path] = []
    for folder in SOURCE_DIRS:
        files.extend(path for path in (ROOT / folder).rglob("*") if path.is_file() and _is_tracked_text_file(path))
    files.extend(path for path in ROOT.iterdir() if path.is_file() and _is_tracked_text_file(path))
    return sorted(set(files))


def iter_js_files() -> list[Path]:
    files: list[Path] = []
    for folder in SOURCE_DIRS:
        files.extend(path for path in (ROOT / folder).rglob("*.js") if path.is_file() and _is_tracked_text_file(path))
    files.extend(path for path in ROOT.glob("*.js") if path.is_file() and _is_tracked_text_file(path))
    return sorted(set(files))


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return path.read_text(encoding="latin-1")


def load_manifest() -> dict:
    return json.loads(read_text(MANIFEST_PATH))


def compile_js(path: Path) -> None:
    source = read_text(path)
    context = quickjs.Context()
    context.eval(f"new Function({json.dumps(source)});")


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()
