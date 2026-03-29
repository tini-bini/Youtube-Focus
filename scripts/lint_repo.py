from __future__ import annotations

import sys

from common import MOJIBAKE_PATTERNS, PLACEHOLDER_PATTERNS, TASK_NOTE_MARKERS, iter_source_files, read_text, rel


def main() -> int:
    failures: list[str] = []

    for path in iter_source_files():
        text = read_text(path)
        for pattern in MOJIBAKE_PATTERNS:
            if pattern in text:
                failures.append(f"{rel(path)} contains mojibake pattern {pattern!r}")

        for pattern in PLACEHOLDER_PATTERNS:
            if pattern in text:
                failures.append(f"{rel(path)} contains unresolved placeholder {pattern}")

        if any(marker in text for marker in TASK_NOTE_MARKERS):
            failures.append(f"{rel(path)} contains unfinished task markers")

    if failures:
        print("Repository lint failed:")
        for failure in failures:
            print(f" - {failure}")
        return 1

    print("Repository lint passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
