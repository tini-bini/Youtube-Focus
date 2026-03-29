from __future__ import annotations

import re
import sys
from pathlib import Path

from common import ROOT, load_manifest, read_text


POPUP_SCRIPT = ROOT / "popup" / "script.js"
POPUP_HTML = ROOT / "popup" / "popup.html"
SETTINGS_SCRIPT = ROOT / "settings" / "settings.js"
SETTINGS_HTML = ROOT / "settings" / "settings.html"


def ids_used_in_script(path: Path) -> set[str]:
    text = read_text(path)
    return set(re.findall(r'getElementById\("([^"]+)"\)', text))


def ids_present_in_html(path: Path) -> set[str]:
    text = read_text(path)
    return set(re.findall(r'id="([^"]+)"', text))


def main() -> int:
    failures: list[str] = []
    manifest = load_manifest()

    required_permissions = {"storage", "activeTab", "scripting", "alarms", "notifications"}
    manifest_permissions = set(manifest.get("permissions", []))
    missing_permissions = required_permissions - manifest_permissions
    if missing_permissions:
        failures.append(f"manifest is missing permissions: {sorted(missing_permissions)}")

    popup_missing = ids_used_in_script(POPUP_SCRIPT) - ids_present_in_html(POPUP_HTML)
    settings_missing = ids_used_in_script(SETTINGS_SCRIPT) - ids_present_in_html(SETTINGS_HTML)
    if popup_missing:
        failures.append(f"popup references missing ids: {sorted(popup_missing)}")
    if settings_missing:
        failures.append(f"settings references missing ids: {sorted(settings_missing)}")

    for relative_path in ("shared/config.js", "shared/paypal.js", "background.js"):
        if not (ROOT / relative_path).exists():
            failures.append(f"required file missing: {relative_path}")

    if failures:
        print("Repository contract/type checks failed:")
        for failure in failures:
            print(f" - {failure}")
        return 1

    print("Repository contract/type checks passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
