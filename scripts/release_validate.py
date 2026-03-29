from __future__ import annotations

import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def run(step: str, command: list[str]) -> None:
    print(f"\n== {step} ==")
    subprocess.run(command, cwd=ROOT, check=True)


def main() -> int:
    run("lint", [sys.executable, "scripts/lint_repo.py"])
    run("typecheck", [sys.executable, "scripts/typecheck_repo.py"])
    run("js-syntax", [sys.executable, "scripts/check_js_syntax.py"])
    run("tests", [sys.executable, "-m", "unittest", "discover", "-s", "tests", "-p", "test_*.py", "-v"])
    run("package", [sys.executable, "scripts/package_release.py"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
