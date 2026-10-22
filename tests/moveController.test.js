// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {isMoveOperation, MoveController, percentageToOpacity} from '../lib/moveController.js';

class Signals {
    constructor() {
        this.handlers = new Map();
        this.nextId = 1;
    }

    connect(name, callback) {
        const id = this.nextId++;
        this.handlers.set(id, {name, callback});
        return id;
    }

    disconnect(id) {
        assert.ok(this.handlers.delete(id), `Unknown signal ${id}`);
    }

    emit(name) {
        for (const [id, handler] of [...this.handlers]) {
            if (this.handlers.has(id) && handler.name === name)
                handler.callback(this);
        }
    }
}

class Actor extends Signals {
    constructor(opacity) {
        super();
        this.opacity = opacity;
        this.transition = null;
    }

    remove_transition(name) {
        assert.equal(name, 'opacity');
        const transition = this.transition;
        this.transition = null;
        transition?.callback(false);
    }

    finish() {
        const transition = this.transition;
        assert.ok(transition);
        this.transition = null;
        this.opacity = transition.target;
        transition.callback(true);
    }
}

function fixture(original = 255) {
    const window = new Signals();
    const actor = new Actor(original);
    const settings = {percentage: 65};
    const controller = new MoveController({
        readPercentage: () => settings.percentage,
        animate: (a, target, callback) => {
            assert.equal(a.transition, null, 'No overlapping transitions');
            a.transition = {target, callback};
        },
        setOpacity: (a, opacity) => { a.opacity = opacity; },
    });
    return {window, actor, settings, controller};
}

function assertReleased(f) {
    assert.equal(f.controller._states.size, 0);
    assert.equal(f.actor.handlers.size, 0);
    assert.equal(f.window.handlers.size, 0);
    assert.equal(f.actor.transition, null);
}

test('percentages convert to nearest 8-bit opacity and clamp to schema bounds', () => {
    assert.equal(percentageToOpacity(10), 26);
    assert.equal(percentageToOpacity(65), 166);
    assert.equal(percentageToOpacity(100), 255);
    assert.equal(percentageToOpacity(-1), 26);
    assert.equal(percentageToOpacity(101), 255);
    for (let percentage = 10; percentage <= 100; percentage += 5)
        assert.ok(Math.abs(percentageToOpacity(percentage) / 255 * 100 - percentage) < 0.2);
});

test('GNOME 51 move enums accept pointer, keyboard and unconstrained moves only', () => {
    // Values from Mutter 51.1 src/meta/meta-enums.h, not invented test enums.
    const grabOp = {MOVING: 1, MOVING_UNCONSTRAINED: 0x401, KEYBOARD_MOVING: 0x101};
    for (const move of [1, 0x401, 0x101, 0x501])
        assert.equal(isMoveOperation(move, grabOp), true);
    for (const direction of [0x1000, 0x2000, 0x4000, 0x8000, 0x9000, 0xa000, 0x5000, 0x6000]) {
        for (const flags of [0, 0x100, 0x400, 0x500])
            assert.equal(isMoveOperation(1 | direction | flags, grabOp), false);
    }
    for (const other of [0, 0x301, 0x701, 2, 3])
        assert.equal(isMoveOperation(other, grabOp), false);
});

test('restores exact original opacity, including non-opaque and zero values', () => {
    for (const original of [0, 97, 203, 255]) {
        const f = fixture(original);
        f.controller.begin(f.window, f.actor);
        assert.equal(f.actor.opacity, 166);
        f.controller.end(f.window);
        assert.equal(f.actor.transition.target, original);
        f.actor.finish();
        assert.equal(f.actor.opacity, original);
        assertReleased(f);
    }
});

test('different windows preserve independent state while one is restoring', () => {
    const f = fixture(211);
    const otherWindow = new Signals();
    const otherActor = new Actor(187);
    f.controller.begin(f.window, f.actor);
    f.controller.end(f.window);
    f.controller.begin(otherWindow, otherActor);
    assert.equal(f.actor.opacity, 166);
    assert.equal(otherActor.opacity, 166);
    f.actor.finish();
    assert.equal(f.actor.opacity, 211);
    assert.equal(otherActor.opacity, 166);
    f.controller.end(otherWindow);
    otherActor.finish();
    assert.equal(otherActor.opacity, 187);
    assertReleased(f);
});

test('rapid re-grab retargets smoothly and rejects stale animation callbacks', () => {
    const f = fixture(230);
    f.controller.begin(f.window, f.actor);
    f.controller.end(f.window);
    const stale = f.actor.transition.callback;
    f.actor.opacity = 199; // Mid-frame interpolated restore value.
    f.controller.begin(f.window, f.actor);
    assert.equal(f.actor.opacity, 199, 'No discontinuity on re-grab');
    assert.equal(f.actor.transition.target, 166);
    stale(true);
    assert.equal(f.controller._states.size, 1);
    f.controller.end(f.window); // Release even before the retarget finishes.
    assert.equal(f.actor.transition.target, 230);
    f.actor.finish();
    assert.equal(f.actor.opacity, 230);
    assertReleased(f);
});

test('repeat events do not accumulate callbacks; settings apply to the next move', () => {
    const f = fixture();
    f.controller.begin(f.window, f.actor);
    f.settings.percentage = 40;
    f.controller.begin(f.window, f.actor);
    assert.equal(f.actor.opacity, 166);
    assert.equal(f.actor.handlers.size, 1);
    assert.equal(f.window.handlers.size, 1);
    f.controller.end(f.window);
    f.controller.end(f.window);
    f.actor.finish();
    f.controller.begin(f.window, f.actor);
    assert.equal(f.actor.opacity, 102);
    f.controller.disable();
    assert.equal(f.actor.opacity, 255);
    assertReleased(f);
});

test('disable cancels animations and restores moving and restoring windows', () => {
    const f = fixture(201);
    const window = new Signals();
    const actor = new Actor(209);
    f.controller.begin(f.window, f.actor);
    f.controller.end(f.window);
    const stale = f.actor.transition.callback;
    f.controller.begin(window, actor);
    f.controller.disable();
    stale(true);
    assert.equal(f.actor.opacity, 201);
    assert.equal(actor.opacity, 209);
    assert.equal(actor.handlers.size, 0);
    assert.equal(window.handlers.size, 0);
    assertReleased(f);
    f.controller.disable();
});

test('unmanaged windows restore immediately, including during a restoration', () => {
    for (const restoring of [false, true]) {
        const f = fixture(199);
        f.controller.begin(f.window, f.actor);
        if (restoring)
            f.controller.end(f.window);
        f.window.emit('unmanaged');
        assert.equal(f.actor.opacity, 199);
        f.controller.end(f.window);
        assertReleased(f);
    }
});

test('actor destruction drops references and cancels callbacks without restoring a dead actor', () => {
    const f = fixture();
    f.controller.begin(f.window, f.actor);
    f.controller.end(f.window);
    f.actor.emit('destroy');
    assertReleased(f);
    f.controller.disable();
});

test('interrupted restoration cleans up and restores the original value', () => {
    const f = fixture(190);
    f.controller.begin(f.window, f.actor);
    f.controller.end(f.window);
    f.actor.remove_transition('opacity');
    assert.equal(f.actor.opacity, 190);
    assertReleased(f);
});

test('actor replacement restores the old actor and captures the new original', () => {
    const f = fixture(205);
    f.controller.begin(f.window, f.actor);
    const replacement = new Actor(170);
    f.controller.begin(f.window, replacement);
    assert.equal(f.actor.opacity, 205);
    assert.equal(f.actor.handlers.size, 0);
    f.controller.disable();
    assert.equal(replacement.opacity, 170);
    assert.equal(replacement.handlers.size, 0);
    assertReleased(f);
});

test('synchronous animation completion (disabled desktop animations) is safe', () => {
    const f = fixture(220);
    f.controller._animate = (actor, opacity, callback) => {
        actor.opacity = opacity;
        callback(true);
    };
    f.controller.begin(f.window, f.actor);
    f.controller.end(f.window);
    assert.equal(f.actor.opacity, 220);
    assertReleased(f);
});

test('100 enable/disable-equivalent controller cycles leave no signal handlers', () => {
    for (let i = 0; i < 100; i++) {
        const f = fixture();
        f.controller.begin(f.window, f.actor);
        if (i % 2)
            f.controller.end(f.window);
        f.controller.disable();
        assertReleased(f);
    }
});
