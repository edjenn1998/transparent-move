// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';

test('Shell adapter filters window types/resize and disconnects across repeated lifecycles', async () => {
    const handlers = new Map();
    let nextId = 1;
    const display = {
        connect(name, callback) {
            const id = nextId++;
            handlers.set(id, {name, callback});
            return id;
        },
        disconnect(id) {
            assert.ok(handlers.delete(id));
        },
    };
    const emit = (name, window, op) => {
        for (const handler of [...handlers.values()]) {
            if (handler.name === name)
                handler.callback(display, window, op, {});
        }
    };
    let percentage = 65;
    const settings = {get_int: key => {
        assert.equal(key, 'move-opacity');
        return percentage;
    }};
    class Extension {
        getSettings() {
            return settings;
        }
    }
    const runtime = {
        Extension,
        Clutter: {AnimationMode: {EASE_OUT_QUAD: 7}},
        Meta: {
            GrabOp: {MOVING: 1, MOVING_UNCONSTRAINED: 0x401, KEYBOARD_MOVING: 0x101},
            WindowType: {NORMAL: 0},
        },
    };
    globalThis.__transparentMoveTest = runtime;
    globalThis.global = {display};
    try {
        // Replace only unavailable platform imports. Execute the actual Shell
        // adapter against doubles, not a copy of its filtering/lifecycle logic.
        let source = await readFile(new URL('../extension.js', import.meta.url), 'utf8');
        source = source
            .replace("import Clutter from 'gi://Clutter';", 'const {Clutter} = globalThis.__transparentMoveTest;')
            .replace("import Meta from 'gi://Meta';", 'const {Meta} = globalThis.__transparentMoveTest;')
            .replace("import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';",
                'const {Extension} = globalThis.__transparentMoveTest;')
            .replace("'./lib/moveController.js'", JSON.stringify(new URL('../lib/moveController.js', import.meta.url).href));
        const {default: TransparentMove} = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
        const extension = new TransparentMove();
        for (let i = 0; i < 10; i++) {
            extension.enable();
            assert.equal(handlers.size, 2);
            const calls = [];
            const realController = extension._controller;
            const actor = {is_destroyed: () => false};
            const window = {get_window_type: () => 0, get_compositor_private: () => actor};
            extension._controller = {
                begin: (w, a) => calls.push([w, a]),
                end: () => {},
                disable: () => realController.disable(),
            };
            for (let type = 1; type <= 15; type++)
                emit('grab-op-begin', {...window, get_window_type: () => type}, 1);
            for (const resize of [0x1001, 0x2101, 0x301, 0x9401])
                emit('grab-op-begin', window, resize);
            emit('grab-op-begin', {...window, get_compositor_private: () => null}, 1);
            emit('grab-op-begin', {...window, get_compositor_private: () => ({is_destroyed: () => true})}, 1);
            assert.equal(calls.length, 0);
            for (const move of [1, 0x401, 0x101, 0x501])
                emit('grab-op-begin', window, move);
            assert.equal(calls.length, 4);
            for (const call of calls)
                assert.deepEqual(call, [window, actor]);
            extension.disable();
            assert.equal(handlers.size, 0);
            assert.equal(extension._settings, null);
            assert.equal(extension._controller, null);
        }

        extension.enable();
        const actorHandlers = new Map();
        const actor = {
            opacity: 219,
            is_destroyed: () => false,
            save_easing_state() {},
            restore_easing_state() {},
            set_easing_duration: duration => assert.equal(duration, 0),
            connect: (name, callback) => { actorHandlers.set(name, callback); return name; },
            disconnect: id => assert.ok(actorHandlers.delete(id)),
            ease(options) {
                assert.equal(options.duration, 150);
                assert.equal(options.mode, 7);
                this.opacity = options.opacity;
                options.onStopped(true);
            },
        };
        const windowHandlers = new Map();
        const window = {
            get_window_type: () => 0,
            get_compositor_private: () => actor,
            connect: (name, callback) => { windowHandlers.set(name, callback); return name; },
            disconnect: id => assert.ok(windowHandlers.delete(id)),
        };
        emit('grab-op-begin', window, 1);
        assert.equal(actor.opacity, 166);
        emit('grab-op-end', window, 1);
        assert.equal(actor.opacity, 219);
        percentage = 10;
        emit('grab-op-begin', window, 0x101);
        assert.equal(actor.opacity, 26);
        extension.disable();
        assert.equal(actor.opacity, 219);
        assert.equal(actorHandlers.size, 0);
        assert.equal(windowHandlers.size, 0);
        assert.equal(handlers.size, 0);
    } finally {
        delete globalThis.__transparentMoveTest;
        delete globalThis.global;
    }
});
