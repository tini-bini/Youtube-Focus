from __future__ import annotations

import json
import zipfile
from datetime import UTC, datetime
from pathlib import Path

from common import ROOT, load_manifest


INCLUDE_PATHS = [
    "manifest.json",
    "background.js",
    "content",
    "icons",
    "popup",
    "settings",
    "shared",
]


def main() -> int:
    manifest = load_manifest()
    version = manifest["version"]
    dist_dir = ROOT / "dist"
    dist_dir.mkdir(exist_ok=True)
    artifact_path = dist_dir / f"realdeal-chrome-extension-v{version}.zip"

    if artifact_path.exists():
        artifact_path.unlink()

    with zipfile.ZipFile(artifact_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for include in INCLUDE_PATHS:
            source = ROOT / include
            if source.is_file():
                archive.write(source, arcname=source.relative_to(ROOT))
                continue

            for path in source.rglob("*"):
                if path.is_file():
                    archive.write(path, arcname=path.relative_to(ROOT))

    metadata_path = dist_dir / "release-metadata.json"
    metadata_path.write_text(
        json.dumps(
            {
                "artifact": artifact_path.name,
                "version": version,
                "packagedAt": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    print(artifact_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
