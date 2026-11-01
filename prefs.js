// SPDX-License-Identifier: GPL-3.0-or-later
import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class TransparentMovePreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage({
            title: 'Transparent Move',
            icon_name: 'preferences-system-windows-symbolic',
        });
        const group = new Adw.PreferencesGroup({
            title: 'Window opacity',
            description: 'Opacity while moving a normal application window. Changes apply to the next move.',
        });
        const row = new Adw.ActionRow({
            title: 'Opacity while moving',
            subtitle: '100% is opaque; 10% is almost transparent.',
        });
        const adjustment = new Gtk.Adjustment({
            lower: 10,
            upper: 100,
            step_increment: 5,
            page_increment: 5,
            value: settings.get_int('move-opacity'),
        });
        const scale = new Gtk.Scale({
            orientation: Gtk.Orientation.HORIZONTAL,
            adjustment,
            draw_value: false,
            digits: 0,
            round_digits: 0,
            width_request: 220,
            valign: Gtk.Align.CENTER,
        });
        scale.update_property([Gtk.AccessibleProperty.LABEL], ['Opacity while moving']);
        const label = new Gtk.Label({width_chars: 4, xalign: 1, valign: Gtk.Align.CENTER});
        const refreshLabel = () => {
            label.label = `${Math.round(adjustment.value)}%`;
        };
        let updating = false;
        const valueId = adjustment.connect('value-changed', () => {
            if (updating)
                return;
            // Gtk.Scale's step increment controls keys, not pointer dragging.
            const value = Math.round(adjustment.value / 5) * 5;
            if (adjustment.value !== value) {
                adjustment.value = value;
                return;
            }
            settings.set_int('move-opacity', value);
            refreshLabel();
        });
        const settingsId = settings.connect('changed::move-opacity', () => {
            // Reflect external values without snapping them and writing them back.
            updating = true;
            adjustment.value = settings.get_int('move-opacity');
            updating = false;
            refreshLabel();
        });
        refreshLabel();
        row.add_suffix(scale);
        row.add_suffix(label);
        row.activatable_widget = scale;
        group.add(row);
        page.add(group);
        window.add(page);
        window.connect('close-request', () => {
            settings.disconnect(settingsId);
            adjustment.disconnect(valueId);
            return false;
        });
    }
}
