// SPDX-License-Identifier: GPL-3.0-or-later
import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import {isMoveOperation, MoveController} from './lib/moveController.js';

const RESIZE_OPS = [
    Meta.GrabOp.RESIZING_W, Meta.GrabOp.RESIZING_E,
    Meta.GrabOp.RESIZING_N, Meta.GrabOp.RESIZING_S,
    Meta.GrabOp.RESIZING_NW, Meta.GrabOp.RESIZING_NE,
    Meta.GrabOp.RESIZING_SE, Meta.GrabOp.RESIZING_SW,
];


export default class TransparentMove extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._controller = new MoveController({
            readPercentage: () => this._settings.get_int('move-opacity'),
            animate: (actor, opacity, onStopped) => actor.ease({
                opacity,
                duration: 150,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                onStopped,
            }),
            setOpacity: (actor, opacity) => {
                // Do not inherit another caller's implicit easing state.
                actor.save_easing_state();
                actor.set_easing_duration(120);
                actor.set_easing_mode(Clutter.AnimationMode.EASE_OUT_QUAD);
                actor.opacity = opacity;
                actor.restore_easing_state();
            },
        });

        this._beginId = global.display.connect('grab-op-begin',
            (_display, window, operation, _sprite) => {
                if (!(isMoveOperation(operation, Meta.GrabOp) ||
                      RESIZE_OPS.includes(operation)) ||
                    window.get_window_type() !== Meta.WindowType.NORMAL)
                    return;

                const actor = window.get_compositor_private();
                if (actor && !actor.is_destroyed())
                    this._controller.begin(window, actor);
            });
        this._endId = global.display.connect('grab-op-end',
            (_display, window, _operation) => this._controller.end(window));
    }

    disable() {
        if (this._beginId)
            global.display.disconnect(this._beginId);
        if (this._endId)
            global.display.disconnect(this._endId);
        this._beginId = 0;
        this._endId = 0;

        this._controller?.disable();
        this._controller = null;
        this._settings = null;
    }
}
