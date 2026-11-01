#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Build the extension ZIP and validate its settings schema."""
import json
from pathlib import Path
import subprocess
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parent.parent
SCHEMA = "org.gnome.shell.extensions.transparent-move.gschema.xml"
FILES = (
    "extension.js", "prefs.js", "metadata.json", "lib/moveController.js",
    f"schemas/{SCHEMA}", "LICENSE",
)


def main():
    metadata = json.loads((ROOT / "metadata.json").read_text())
    output = ROOT / "dist" / f"{metadata['uuid']}.shell-extension.zip"
    output.parent.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="transparent-move-pack-") as temp:
        schema_dir = Path(temp)
        (schema_dir / SCHEMA).write_bytes((ROOT / "schemas" / SCHEMA).read_bytes())
        subprocess.run(["glib-compile-schemas", "--strict", str(schema_dir)], check=True)
        with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
            for name in FILES:
                archive.write(ROOT / name, name)
    with zipfile.ZipFile(output) as archive:
        assert archive.testzip() is None
        assert set(archive.namelist()) == set(FILES)
    print(f"Created and verified {output}")


if __name__ == "__main__":
    main()
