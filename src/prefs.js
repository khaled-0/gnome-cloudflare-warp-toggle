import Adw from "gi://Adw";
import Gio from "gi://Gio";
import Gtk from "gi://Gtk";

import { ExtensionPreferences } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";
export default class WARPToggleExtensionPreferences extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    window._settings = this.getSettings();
    const page = new Adw.PreferencesPage();
    window.add(page);

    const group = new Adw.PreferencesGroup();
    page.add(group);

    const statusCheckSwitchRow = new Adw.ActionRow({
      title: "Background status checks",
      subtitle: "Update indicator by running warp-cli status periodically",
    });

    const statusCheckSwitch = new Gtk.Switch({
      active: window._settings.get_boolean("status-check"),
      valign: Gtk.Align.CENTER,
    });

    window._settings.bind(
      "status-check",
      statusCheckSwitch,
      "active",
      Gio.SettingsBindFlags.DEFAULT
    );

    statusCheckSwitchRow.add_suffix(statusCheckSwitch);
    statusCheckSwitchRow.activatable_widget = statusCheckSwitch;
    group.add(statusCheckSwitchRow);

    const statusCheckFreqRow = new Adw.ActionRow({
      title: "Status check frequency (in seconds)",
      subtitle: "Too frequent checks may impact performance",
    });

    const statusCheckFrequencyField = new Gtk.SpinButton({
      adjustment: new Gtk.Adjustment({
        value: 30,
        lower: 1,
        upper: 3600,
        step_increment: 5,
      }),
    });

    window._settings.bind(
      "status-check-freq",
      statusCheckFrequencyField,
      "value",
      Gio.SettingsBindFlags.DEFAULT
    );

    statusCheckFreqRow.add_suffix(statusCheckFrequencyField);
    statusCheckFreqRow.activatable_widget = statusCheckFrequencyField;
    group.add(statusCheckFreqRow);
  }
}
