from __future__ import annotations

import sys

from common import compile_js, iter_js_files, rel


def main() -> int:
    failures: list[str] = []
    for path in iter_js_files():
        try:
            compile_js(path)
            print(f"OK {rel(path)}")
        except Exception as exc:  # noqa: BLE001
            failures.append(f"{rel(path)}: {exc}")

    if failures:
        print("\nJavaScript syntax check failed:")
        for failure in failures:
            print(f" - {failure}")
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
