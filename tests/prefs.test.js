// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import vm from 'node:vm';

class Signals {
    handlers = new Map();
    connect(name, callback) {
        const id = Symbol(name);
        this.handlers.set(id, {name, callback});
        return id;
    }
    disconnect(id) { assert.ok(this.handlers.delete(id)); }
    emit(name) {
        for (const handler of this.handlers.values()) {
            if (handler.name === name)
                handler.callback();
        }
    }
}

const source = readFileSync(new URL('../prefs.js', import.meta.url), 'utf8')
    .replace(/^import .*;\n/gm, '').replace('export default class', 'class');

function preferences(initial = 65) {
    let value = initial;
    const writes = [];
    const settings = Object.assign(new Signals(), {
        get_int: () => value,
        set_int: (_key, next) => {
            writes.push(next);
            if (value !== next) {
                value = next;
                settings.emit('changed::move-opacity');
            }
        },
    });
    let adjustment;
    let label;
    class Widget {
        add() {}
        add_suffix() {}
        update_property() {}
    }
    class Adjustment extends Signals {
        constructor(properties) {
            super();
            this._value = properties.value;
            adjustment = this;
        }
        get value() { return this._value; }
        set value(next) {
            if (this._value !== next) {
                this._value = next;
                this.emit('value-changed');
            }
        }
    }
    const Preferences = vm.runInNewContext(`${source}\nTransparentMovePreferences`, {
        ExtensionPreferences: class { getSettings() { return settings; } },
        Adw: {PreferencesPage: Widget, PreferencesGroup: Widget, ActionRow: Widget},
        Gtk: {Adjustment, Scale: Widget, Label: class { constructor() { label = this; } },
            Orientation: {HORIZONTAL: 0}, Align: {CENTER: 0}, AccessibleProperty: {LABEL: 0}},
    });
    const window = Object.assign(new Signals(), {add() {}});
    new Preferences().fillPreferencesWindow(window);
    return {settings, adjustment, label, window, writes,
        get value() { return value; },
        changeExternally(next) { value = next; settings.emit('changed::move-opacity'); }};
}

test('slider input snaps once to a 5% step and updates the label', () => {
    const f = preferences();
    assert.deepEqual(f.writes, []);
    assert.equal(f.label.label, '65%');
    f.adjustment.value = 38;
    assert.equal(f.adjustment.value, 40);
    assert.equal(f.value, 40);
    assert.equal(f.label.label, '40%');
    assert.deepEqual(f.writes, [40]);
});

test('opening preferences and reflecting external settings do not rewrite their values', () => {
    const f = preferences(37);
    assert.equal(f.label.label, '37%');
    assert.deepEqual(f.writes, []);
    f.changeExternally(43);
    assert.equal(f.value, 43);
    assert.equal(f.adjustment.value, 43);
    assert.equal(f.label.label, '43%');
    assert.deepEqual(f.writes, []);
});

test('closing preferences disconnects the settings and adjustment callbacks', () => {
    const f = preferences();
    f.window.emit('close-request');
    assert.equal(f.settings.handlers.size, 0);
    assert.equal(f.adjustment.handlers.size, 0);
    f.changeExternally(40);
    f.adjustment.value = 50;
    assert.deepEqual(f.writes, []);
});
