# GNOME 51.1 API investigation

The following upstream **51.1 release-tagged** sources were inspected during
development. These are source-level compatibility checks, not desktop execution.

## Interactive movement

- [Mutter display.c](https://github.com/GNOME/mutter/blob/51.1/src/core/display.c#L379-L398):
  `Meta.Display::grab-op-begin` passes `(window, operation, sprite)`;
  `grab-op-end` passes `(window, operation)`. GJS callbacks receive the emitting
  display first. The extension ignores the sprite and never consumes input events.
- [Mutter meta-enums.h](https://github.com/GNOME/mutter/blob/51.1/src/meta/meta-enums.h#L61-L109):
  `Meta.GrabOp.MOVING`, `MOVING_UNCONSTRAINED`, and `KEYBOARD_MOVING` are public enum
  members. The unconstrained flag is derived from the two pointer-move enums and
  stripped before exact move comparisons. Merely testing the `MOVING` bit is wrong:
  resizing enum values also contain the window-base bit.
- [Mutter meta-window-drag.c](https://github.com/GNOME/mutter/blob/51.1/src/compositor/meta-window-drag.c):
  the drag implementation emits begin/end on the display and ends grabs on
  `Meta.Window::unmanaged`. End is handled by tracked-window identity rather than
  requiring an unchanged operation enum; this tolerates internal op changes.
- [Mutter window.h](https://github.com/GNOME/mutter/blob/51.1/src/meta/window.h):
  `get_window_type()` provides `Meta.WindowType.NORMAL`; strict equality excludes
  dialogs and all other window types. `get_compositor_private()` supplies the
  `Meta.WindowActor` for compositor-side changes.

## Actors and easing

- [Mutter meta-window-actor.c](https://github.com/GNOME/mutter/blob/51.1/src/compositor/meta-window-actor.c#L803-L818):
  `is_destroyed()` checks disposed/pending destruction state before tracking starts.
- [Clutter actor implementation](https://github.com/GNOME/mutter/blob/51.1/clutter/clutter/clutter-actor.c):
  actors expose the 8-bit `opacity` property, `destroy` signal, easing state, and
  named transition removal. No position/size properties are written.
- [GNOME Shell environment.js](https://github.com/GNOME/gnome-shell/blob/51.1/js/ui/environment.js):
  Shell supplies `Clutter.Actor.ease()`, accepts `duration`, `mode`, and
  `onStopped(finished)`, and removes overwritten property transitions. Its helper
  handles disabled animations synchronously, actor destruction, and transition
  removal, and internally catches expected cancellation errors. Its easing-duration
  wrapper respects GNOME animation settings. The extension uses this callback API
  rather than relying on a return value or accumulating promises.

Each tracked actor retains one original-opacity snapshot until fully restored.
Cancellation increments a generation **before** removing `opacity`, since removal
can invoke `onStopped` synchronously. Stale callbacks cannot release a new move.
On a re-grab, the existing restore is canceled and easing is retargeted to the move
opacity from the current frame, preserving continuity without recapturing the
baseline. While moving, the target remains stable; there is no frame listener.

Each active/animating state has one actor-destroy and one window-unmanaged handler.
Completion, unmanagement, destruction, and disable release both. Unmanagement
restores immediately so a later close effect does not inherit moving opacity.
Destroy drops state without writing opacity to a dying actor. Disable disconnects
display handlers first, invalidates/removes owned transitions, and restores every
surviving tracked actor immediately. No timers or polling sources are created.

The extension claims the opacity property while a move/restoration is tracked.
Concurrent opacity animation by another extension is not composable; an interrupted
restoration cleans up and restores the saved baseline. Existing foreign animations
are not resumed. Shell handles the lock-screen lifecycle through the default
`user` session mode; no unlock-dialog support is declared.

## Extension and preferences conventions

- [Extension base class](https://github.com/GNOME/gnome-shell/blob/51.1/js/extensions/extension.js)
- [Preferences base class](https://github.com/GNOME/gnome-shell/blob/51.1/js/extensions/prefs.js)
- [Shared settings loader](https://github.com/GNOME/gnome-shell/blob/51.1/js/extensions/sharedInternals.js)

Runtime and preferences use separate ES-module entry points and current resource
paths. `getSettings()` uses `settings-schema` metadata and the packaged local
schema. Runtime reads settings on each new move, so it needs no settings-change
signal. Preferences uses GTK4 `Scale`/`Adjustment`, Libadwaita preference rows,
and a GSettings changed handler disconnected when its window closes.

No legacy `init()`, `imports.ui`, `Main.wm` monkey-patching, private input hooks,
application-window property writes, network requests, or process spawning are used.

Also consulted: the [GNOME 51 porting guide](https://gjs.guide/extensions/upgrading/gnome-shell-51.html)
and [extension review guidelines](https://gjs.guide/extensions/review-guidelines/review-guidelines.html).
`disable()` is synchronous, runtime and preferences imports are kept separate,
there are no module-initialization side effects, and development scripts/tests are
excluded from the submission archive. The requested local `version: 1` is kept;
EGO assigns its own uploaded extension version.
