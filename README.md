# Transparent Move

A GNOME Shell **51** extension that makes a window partially transparent while
you move it, then smoothly restores its original opacity when you let go.

## Install

Download `transparent-move@edjenn1998.shell-extension.zip` from the
[latest release](https://github.com/edjenn1998/transparent-move/releases/latest).
In the download directory, run:

```sh
gnome-extensions install --force transparent-move@edjenn1998.shell-extension.zip
```

Log out and back in to load the installed JavaScript, then enable the extension:

```sh
gnome-extensions enable transparent-move@edjenn1998
```

Requires GNOME Shell 51 on Wayland. Runtime libraries are supplied by GNOME;
Node.js and Python are only needed for development.

## Usage

Move a normal application window by its titlebar, with your window-move modifier,
or through the window menu's **Move** action, usually Alt+F7. Only the moving
window's opacity changes. Mutter still handles its position and input.

- Moving opacity defaults to **65%**, adjustable from **10% to 100%**.
- Releasing or cancelling a move restores the exact original opacity with a
  **150 ms ease-out** animation, respecting GNOME's animation settings.
- Quickly grabbing the window again retargets the animation from its current
  opacity without losing the original value.
- Disabling the extension or unmanaging a window restores it immediately.
- Resizing, dialogs and other non-normal window types are excluded.

The extension is event-driven: it does not poll windows or run external commands.

## Preferences

Open settings in the Extensions app or run:

```sh
gnome-extensions prefs transparent-move@edjenn1998
```

The slider adjusts **opacity**, not transparency:

| Value | Appearance while moving |
| --- | --- |
| 100% | Opaque |
| 65% | Partially transparent; the default |
| 10% | Almost transparent |

Slider input snaps to 5% steps. Settings save immediately and apply to the next
move; they do not change an ongoing move. Values set through GSettings are shown
without being rounded and written back by the preferences window.

To inspect or reset the setting for a user installation:

```sh
schema_dir="${XDG_DATA_HOME:-$HOME/.local/share}/gnome-shell/extensions/transparent-move@edjenn1998/schemas"
gsettings --schemadir "$schema_dir" get org.gnome.shell.extensions.transparent-move move-opacity
gsettings --schemadir "$schema_dir" reset org.gnome.shell.extensions.transparent-move move-opacity
```

Reset restores 65%. The schema accepts integer values from 10 to 100.

## Troubleshooting

```sh
gnome-extensions info transparent-move@edjenn1998
journalctl --user -b -f -o cat /usr/bin/gnome-shell
```

- **Not found or old behavior after an update:** confirm the UUID and installed
  ZIP, then log out and back in.
- **Missing schema:** reinstall the extension ZIP so GNOME compiles its schema.
- **No visible change:** check that the extension is enabled, the opacity is below
  100%, and you are moving a normal window rather than resizing it.
- **Conflicting effects:** another extension writing the same actor's opacity can
  interfere. Transparent Move restores its saved baseline, but does not resume
  another extension's animation.

For a bug report, include GNOME/Mutter versions, the extension version, reproduction
steps and relevant journal errors. The issue tracker is on
[GitHub](https://github.com/edjenn1998/transparent-move/issues).

## Build and check

Required: Node.js 22+, Python 3 and GLib's schema/GSettings tools. There are no npm
dependencies to install.

```sh
npm run check
npm run pack
```

The ZIP is created in `dist/`. It contains the entry points, controller, metadata,
schema XML and GPL license. GNOME compiles the schema during installation.

Checks cover syntax, metadata/schema agreement, settings bounds and persistence,
move filtering, animation cancellation, opacity restoration and preferences updates.
Tests use doubles for GNOME widgets and services. See [docs/TESTING.md](docs/TESTING.md)
for results and native desktop checks, and [docs/API-51.md](docs/API-51.md) for API notes.

## Remove

```sh
gnome-extensions disable transparent-move@edjenn1998
gnome-extensions uninstall transparent-move@edjenn1998
```

## License

Copyright © 2026 edjenn1998. Licensed under **GPL-3.0-or-later**; see [LICENSE](LICENSE).
