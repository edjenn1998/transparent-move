# Validation and desktop acceptance

## Automated headless checks

Run from the repository root:

```sh
npm run check
python3 tools/package.py
python3 -m zipfile -t dist/transparent-move@edjenn1998.shell-extension.zip
```

These check ES-module syntax, metadata/schema agreement, strict schema compilation,
default/bounds/reset, and settings persistence across fresh processes with an
isolated keyfile backend. Node tests execute production controller code and the
actual Shell adapter with platform imports replaced by test doubles. They exercise:

- Nearest-8-bit conversion and range endpoints.
- Pointer/keyboard/unconstrained moves versus all directional resize combinations.
- Filtering of all non-normal Mutter window types, missing/destroyed actors.
- Independent windows and overlapping restoration/movement.
- Original opacity (including 0 and non-255 values).
- Rapid re-grab, mid-animation release, stale callbacks, interrupted restoration.
- Settings changes on subsequent moves, duplicate events, synchronous completion.
- Disable while moving/restoring, actor destruction, unmanagement, actor replacement.
- Repeated adapter enable/disable and controller teardown without leaked handlers.

The tests do **not** load GJS/GI, GTK, Libadwaita, Mutter, or a Wayland compositor.
Source inspection is documented in [API-51.md](API-51.md). There is no claim of
executed desktop acceptance or successful EGO review.

## CachyOS GNOME 51.1 Wayland acceptance checklist

Install using the README. Perform these tests locally in the laptop's desktop
session, with unrelated opacity/window-effect extensions disabled initially.
Keep Shell logs open using the README commands. Record GNOME/Mutter versions,
Wayland session, test date, results, and relevant exceptions.

| Test | Action and expected result | Status |
| --- | --- | --- |
| Load | Enable; status is enabled with no exception | Pending |
| Pointer | Drag a normal native Wayland app; only it becomes 65% opaque | Pending |
| Keyboard | Window menu → Move / Alt+F7; arrows then Enter/Escape restore | Pending |
| Modifier | Configured Super+drag and unconstrained moves work | Pending |
| Resize | Drag every edge/corner; keyboard resize; no opacity change | Pending |
| Scope | Try dialogs, menus, popovers, tooltips, notifications, panel, desktop, overview | Pending |
| Multiple apps | Move A, quickly move B while A restores; each restores independently | Pending |
| Restoration | Release/cancel; smooth ~150 ms ease-out; no geometry change from extension | Pending |
| Re-grab | Release/re-grab many times within 150 ms; no snaps or baseline drift | Pending |
| Preferences | GTK4/Adw opens; label/slider agree; pointer/keys use 5% increments | Pending |
| Endpoints | 10%, 65%, 100% have expected opacity; next move sees changed setting | Pending |
| Live setting | Change settings during keyboard move; current target stable, next move updated | Pending |
| Persistence | Close/reopen preferences, log out/in, then reboot locally; chosen value persists | Pending |
| Close | Close/terminate app during keyboard move and during restoration; no errors | Pending |
| Disable | Disable during move and during restoration; immediate exact restoration | Pending |
| Lifecycle | Repeat disable/enable at least 20 times; no duplicate effects/errors | Pending |
| Lock/unlock | Lock while moving; unlock; no lingering effect or lock-screen change | Pending |
| Animations off | Disable desktop animations; release/disable still restores correctly | Pending |
| Tiling | Drag maximized/tiled windows, snap, change monitor/workspace; normal Shell behavior | Pending |
| XWayland | If available, move/resize a normal XWayland app under Wayland | Pending |
| Baseline | Test a deliberately non-255 actor opacity as described below | Pending |

### Exact original actor opacity

Visual inspection cannot prove exact restoration. On the test laptop only, Looking
Glass (Alt+F2 → `lg`) can inspect actors. Open a disposable normal app with a unique
title (for example a terminal titled `Transparent Move Test`), and use:

```js
global.get_window_actors().filter(a => a.meta_window.get_title() === 'Transparent Move Test')
```

Confirm there is **exactly one** match. For that test actor, record its initial
`opacity` before changing it. Set it to 203 in Looking Glass using the same lookup:

```js
global.get_window_actors().find(a => a.meta_window.get_title() === 'Transparent Move Test').opacity = 203
```

Close Looking Glass, move/release the test window, wait for restoration, reopen
Looking Glass, and inspect the actor's opacity: it must be exactly 203. Repeat
rapid moves, and disable during a keyboard move (for example from a second local
terminal using `gnome-extensions disable transparent-move@edjenn1998`). Inspect
again. Restore the recorded initial opacity when finished; close the disposable
test app. Do not run actor-mutating snippets against unrelated windows.

### Settings persistence backend

The automated keyfile test proves the schema can persist across processes without
altering the developer's settings. It does not test the laptop's dconf service.
On the laptop set 40%, reopen preferences, log out/in, and reboot when convenient.
Use the README's `gsettings --schemadir ... get ...` command after each step; expect
40. Reset to 65% when finished if desired.

### Packaging and review

Inspect the ZIP member listing: root entry points/metadata, library, schema XML and
LICENSE; no compiled schema, containing folder, tests, secrets, caches, or
Git internals. Before submission, capture genuine screenshots, record this manual
matrix, inspect all changes, and verify GNOME extension review guidelines. Do not
restart or replace a production Shell remotely.
