#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Validate metadata/schema and exercise GSettings using an isolated keyfile backend."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
SCHEMA_ID = "org.gnome.shell.extensions.transparent-move"
SCHEMA_FILE = f"{SCHEMA_ID}.gschema.xml"


def main():
    metadata = json.loads((ROOT / "metadata.json").read_text())
    assert metadata["uuid"] == "transparent-move@edjenn1998"
    assert metadata["shell-version"] == ["51"]
    assert metadata["version"] == 1
    assert metadata["settings-schema"] == SCHEMA_ID
    schema = ET.parse(ROOT / "schemas" / SCHEMA_FILE).getroot().find("schema")
    assert schema.attrib == {"id": SCHEMA_ID, "path": "/org/gnome/shell/extensions/transparent-move/"}
    key = schema.find("key")
    assert key.attrib == {"name": "move-opacity", "type": "i"}
    assert key.find("range").attrib == {"min": "10", "max": "100"}
    assert key.findtext("default") == "65"

    with tempfile.TemporaryDirectory(prefix="transparent-move-check-") as temp:
        path = Path(temp)
        (path / SCHEMA_FILE).write_bytes((ROOT / "schemas" / SCHEMA_FILE).read_bytes())
        subprocess.run(["glib-compile-schemas", "--strict", "--dry-run", str(path)], check=True)
        subprocess.run(["glib-compile-schemas", "--strict", str(path)], check=True)
        env = dict(os.environ, GSETTINGS_SCHEMA_DIR=temp, GSETTINGS_BACKEND="keyfile",
                   XDG_CONFIG_HOME=str(path / "config"))

        def settings(*args, success=True):
            result = subprocess.run(["gsettings", *args], env=env, text=True, capture_output=True)
            assert (result.returncode == 0) == success, result.stderr
            return result.stdout.strip()

        assert settings("get", SCHEMA_ID, "move-opacity") == "65"
        settings("set", SCHEMA_ID, "move-opacity", "40")
        # Each invocation is a fresh process: the backend must persist the value.
        assert settings("get", SCHEMA_ID, "move-opacity") == "40"
        assert (path / "config" / "glib-2.0" / "settings" / "keyfile").is_file()
        for value in ["9", "101"]:
            settings("set", SCHEMA_ID, "move-opacity", value, success=False)
        assert settings("get", SCHEMA_ID, "move-opacity") == "40"
        for value in ["10", "100"]:
            settings("set", SCHEMA_ID, "move-opacity", value)
            assert settings("get", SCHEMA_ID, "move-opacity") == value
        settings("reset", SCHEMA_ID, "move-opacity")
        assert settings("get", SCHEMA_ID, "move-opacity") == "65"
    print("PASS: metadata, strict schema compilation, defaults, bounds, reset, cross-process persistence")


if __name__ == "__main__":
    main()
