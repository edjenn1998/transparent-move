// SPDX-License-Identifier: GPL-3.0-or-later

export function percentageToOpacity(percentage) {
    return Math.round(Math.min(100, Math.max(10, percentage)) * 255 / 100);
}

export function isMoveOperation(operation, grabOp) {
    // Derive the unconstrained flag from public enum members. Unlike testing
    // the MOVING bit, these exact comparisons cannot accept resize operations.
    const unconstrained = grabOp.MOVING_UNCONSTRAINED ^ grabOp.MOVING;
    const constrained = operation & ~unconstrained;
    return constrained === grabOp.MOVING || constrained === grabOp.KEYBOARD_MOVING;
}

/** Event-driven state machine, with Shell-specific animation injected by extension.js. */
export class MoveController {
    constructor({readPercentage, animate, setOpacity}) {
        this._readPercentage = readPercentage;
        this._animate = animate;
        this._setOpacity = setOpacity;
        this._states = new Map();
    }

    begin(window, actor) {
        let state = this._states.get(window);
        if (state && state.actor !== actor) {
            this._release(state, true);
            state = null;
        }

        if (state?.moving)
            return;

        const resuming = Boolean(state);
        if (!state) {
            state = {
                window,
                actor,
                originalOpacity: actor.opacity,
                moving: true,
                generation: 0,
                animating: false,
            };
            this._states.set(window, state);
            state.destroyId = actor.connect('destroy', () => this._release(state, false));
            // Restore before a possible close animation; actor destruction can
            // happen later than Meta.Window::unmanaged.
            state.unmanagedId = window.connect('unmanaged', () => this._release(state, true));
        }

        this._cancelAnimation(state);
        state.moving = true;
        const opacity = percentageToOpacity(this._readPercentage());
        if (resuming && actor.opacity !== opacity) {
            // Retarget from the current interpolated value, never snapshotting
            // it as the original or snapping back during a rapid re-grab.
            this._transition(state, opacity, false);
        } else {
            this._setOpacity(actor, opacity);
        }
    }

    end(window) {
        const state = this._states.get(window);
        if (!state?.moving)
            return;

        this._cancelAnimation(state);
        state.moving = false;
        this._transition(state, state.originalOpacity, true);
    }

    _transition(state, opacity, releaseWhenDone) {
        const generation = ++state.generation;
        state.animating = true;
        this._animate(state.actor, opacity, finished => {
            if (state.generation !== generation || this._states.get(state.window) !== state)
                return;

            state.animating = false;
            // Also clean up if another effect interrupts our restoration.
            if (releaseWhenDone)
                this._release(state, true);
            else if (finished)
                this._setOpacity(state.actor, opacity);
        });
    }

    _cancelAnimation(state) {
        // Invalidate first: remove_transition synchronously calls onStopped.
        state.generation++;
        if (state.animating) {
            state.animating = false;
            state.actor.remove_transition('opacity');
        }
    }

    _release(state, restore) {
        if (this._states.get(state.window) !== state)
            return;

        this._states.delete(state.window);
        this._cancelAnimation(state);
        state.actor.disconnect(state.destroyId);
        state.window.disconnect(state.unmanagedId);
        if (restore)
            this._setOpacity(state.actor, state.originalOpacity);
    }

    disable() {
        for (const state of this._states.values())
            this._release(state, true);
        this._readPercentage = null;
        this._animate = null;
        this._setOpacity = null;
    }
}
