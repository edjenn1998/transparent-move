# Transparent Move

A small GNOME Shell extension that makes the application window you are moving
partially transparent, then smoothly restores its original opacity when you let go.

- **Target:** GNOME Shell **51**, Wayland
- **UUID:** `transparent-move@edjenn1998`
- **Initial extension version:** 1
- **Project:** <https://github.com/edjenn1998/transparent-move>
- **Maintainer:** [edjenn1998](https://github.com/edjenn1998)
- **License:** GPL-3.0-or-later

## Features

- Pointer, keyboard, and unconstrained interactive window moves.
- Only normal application windows are eligible; resize operations, dialogs, menus,
  notifications, panels, desktop elements, and lock-screen UI are excluded.
- Actual moving-window opacity from **10% to 100%**, default **65%**.
- Native GTK4/Libadwaita preferences with a slider, 5% steps, and percentage label.
- GSettings persistence and settings changes available on the next move.
- A **150 ms ease-out** restoration to the exact original 8-bit actor opacity,
  including actors that were already partially transparent.
- Rapid re-grabs cancel restoration and smoothly retarget from the current opacity,
  retaining the original baseline. This retarget also takes up to 150 ms.
- Immediate restoration on disable or window unmanagement; safe actor-destroy cleanup.
- No polling, runtime dependencies outside GNOME, network requests, telemetry, or
  external commands during operation.

## Compatibility and validation status

Only GNOME Shell **51** is declared compatible. The implementation was checked
against GNOME Shell and Mutter **51.1** source, including grab signal signatures,
move enums, actor APIs, and Shell animation cancellation semantics.

Development/static validation runs on a headless Ubuntu Server. **The extension
and preferences have not yet been exercised in a running GNOME 51 session.**
The intended desktop test environment is CachyOS, GNOME 51.1, Wayland, on a Dell
XPS 13. Desktop verification is required before EGO submission. See
[docs/TESTING.md](docs/TESTING.md) for the test matrix and evidence boundaries.

## Installation on CachyOS GNOME 51.1

Run these commands locally on the laptop, as your desktop user. After GitHub
publication, obtain the project with:

```sh
git clone https://github.com/edjenn1998/transparent-move.git
```

Before publication, copy this source directory or the generated ZIP from the
development machine instead. Run the following from the project directory:

```sh
gnome-shell --version
printenv XDG_SESSION_TYPE
python3 tools/package.py
gnome-extensions install dist/transparent-move@edjenn1998.shell-extension.zip
```

The first two commands should report GNOME Shell 51.x and `wayland`.
Packaging needs Python 3 and `glib-compile-schemas` (CachyOS/Arch's `glib2` package).
If replacing an existing installation, disable it first and use
`gnome-extensions install --force` with the ZIP path.

**Log out and log back in locally** after the first installation, or after updating
loaded JavaScript. Wayland Shell cannot be reloaded with Alt+F2 → `r`.
Save your work before logging out. Then:

```sh
gnome-extensions enable transparent-move@edjenn1998
gnome-extensions info transparent-move@edjenn1998
gnome-extensions prefs transparent-move@edjenn1998
```

The extension is not yet distributed through extensions.gnome.org. Do not disable
Shell version validation to install on another GNOME release.

### Manual installation

From the source checkout, with the extension disabled if already installed:

```sh
extension_dir="${XDG_DATA_HOME:-$HOME/.local/share}/gnome-shell/extensions/transparent-move@edjenn1998"
mkdir -p "$extension_dir/lib" "$extension_dir/schemas"
cp extension.js prefs.js metadata.json README.md LICENSE "$extension_dir/"
cp lib/moveController.js "$extension_dir/lib/"
cp schemas/org.gnome.shell.extensions.transparent-move.gschema.xml "$extension_dir/schemas/"
glib-compile-schemas --strict "$extension_dir/schemas"
```

Log out/in locally and enable as above. Do not install into `/usr/share` or run
these commands as root. To remove it:

```sh
gnome-extensions disable transparent-move@edjenn1998
gnome-extensions uninstall transparent-move@edjenn1998
```

## Usage and preferences

Move a normal application window by dragging its titlebar, using the configured
window-move modifier gesture, or using the window menu's **Move** action (typically
Alt+F7 for keyboard movement). Only the moved actor changes opacity; its position,
size, input handling, and movement remain controlled by Mutter.

Open preferences through the Extensions application or the CLI command above.
The slider expresses **opacity**, not transparency:

| Value | Appearance while moving |
| --- | --- |
| 100% | Completely opaque |
| 65% | Partially transparent (default) |
| 10% | Almost completely transparent |

Settings are saved immediately and persist across sessions and restarts. Changing
the slider does not alter an ongoing move; the next move uses the latest setting.
The actor range is 0–255; 65% maps to 166, the nearest representable value.
The 150 ms animation respects GNOME's enable-animations setting and animation
slowdown factor; disabling desktop animations makes restoration immediate.

## Screenshots

- **Moving-window screenshot:** placeholder; capture on the GNOME 51.1 laptop.
- **Preferences screenshot:** placeholder; capture after desktop validation.

No screenshots or desktop test results are currently available.

## Troubleshooting and logs

Inspect status and watch logs while reproducing an issue:

```sh
gnome-extensions info transparent-move@edjenn1998
journalctl --user -b -f -o cat /usr/bin/gnome-shell
```

If your distribution routes Shell logs outside the user journal:

```sh
journalctl -b -f -o cat _COMM=gnome-shell
```

Look for `transparent-move`, JavaScript exceptions, and GObject warnings. Looking
Glass (Alt+F2 → `lg`) can also show extension errors. Redact unrelated personal
window titles or other private log content before posting an issue.

- **Extension not found:** check the exact UUID/directory name, then log out/in.
- **Missing schema:** rerun strict schema compilation in the installed `schemas`
  directory, or reinstall the packaged ZIP.
- **Nothing happens:** check GNOME 51, enabled status, a normal window, and that
  the slider is below 100%. A resize or excluded dialog intentionally has no effect.
- **Other opacity effects:** extensions that concurrently animate the same
  actor's `opacity` can conflict. Disable those while testing. Transparent Move
  preserves the value captured before its move, but cannot arbitrate simultaneous
  writers to the same compositor property or resume a foreign animation.
- **Unexpected appearance:** disable Transparent Move; tracked actors are restored
  immediately. Collect logs and report exact reproduction steps on GitHub.

For command-line setting inspection (using an installed local schema):

```sh
schema_dir="${XDG_DATA_HOME:-$HOME/.local/share}/gnome-shell/extensions/transparent-move@edjenn1998/schemas"
gsettings --schemadir "$schema_dir" get org.gnome.shell.extensions.transparent-move move-opacity
gsettings --schemadir "$schema_dir" reset org.gnome.shell.extensions.transparent-move move-opacity
```

The reset command restores 65%. GSettings uses the desktop's persistent backend;
no private settings files are included in this repository.

## Development and testing

No npm packages need to be installed. Development checks need Node.js 22 or newer,
npm, Python 3, and GLib's schema/GSettings tools:

```sh
npm run check
npm run pack
```

`check` parses JavaScript as ES modules, validates metadata/schema, strictly
compiles the schema in a temporary directory, tests bounds/default/reset and
cross-process settings persistence using an isolated keyfile backend, and runs
Node tests with actor/signal doubles. It does not load GNOME's GI modules or prove
Wayland behavior. Production desktop settings normally use dconf; desktop
persistence still needs manual verification.

Source layout:

```text
extension.js                  GNOME signal/actor adapter and lifecycle
lib/moveController.js          Move tracking, restoration, cancellation, pure helpers
prefs.js                      GTK4/Libadwaita preferences
metadata.json                 UUID, GNOME 51 compatibility, version 1
schemas/                      GSettings schema source
tests/                        Headless controller and Shell adapter tests
tools/                        Static validation and ZIP packaging
docs/API-51.md                Verified upstream API references and design rationale
docs/TESTING.md               Desktop checklist and static test scope
```

## Packaging for GNOME Extensions

```sh
python3 tools/package.py
python3 -m zipfile -l dist/transparent-move@edjenn1998.shell-extension.zip
python3 -m zipfile -t dist/transparent-move@edjenn1998.shell-extension.zip
```

The allowlisted ZIP puts `metadata.json`, `extension.js`, and `prefs.js` at its
root, with `lib/`, schema XML, and GPL license. It has no
enclosing project directory, tests, development tools, `.git`, caches, or local
configuration. The helper compiles the schema strictly and checks archive members
and integrity. GNOME's installer compiles the XML on installation; compiled
schemas are not bundled. Archives and compiled schemas are ignored by Git.

After laptop testing, submit this ZIP yourself at
<https://extensions.gnome.org/upload/>. This project does not automatically submit
to EGO, and packaging success does not imply EGO review approval.

## License

Copyright © 2026 edjenn1998. Original project code and documentation are licensed
under the **GNU General Public License, version 3 or (at your option) any later
version**, SPDX `GPL-3.0-or-later`. See [LICENSE](LICENSE) for the complete GPLv3
text. There is no warranty. Upstream sources were consulted as API references;
no third-party extension implementation or runtime dependency was copied.
