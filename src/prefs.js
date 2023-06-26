const { Adw, Gio, Gtk } = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;

// eslint-disable-next-line no-unused-vars
function init() {}

// eslint-disable-next-line no-unused-vars
function fillPreferencesWindow(window) {
  const settings = ExtensionUtils.getSettings();
  const page = new Adw.PreferencesPage();
  window.add(page);

  const group = new Adw.PreferencesGroup();
  page.add(group);

  const statusCheckSwitchRow = new Adw.ActionRow({
    title: "Background status checks",
    subtitle: "Update indicator by running warp-cli status periodically",
  });

  const statusCheckSwitch = new Gtk.Switch({
    active: settings.get_boolean("status-check"),
    valign: Gtk.Align.CENTER,
  });

  settings.bind(
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

  settings.bind(
    "status-check-freq",
    statusCheckFrequencyField,
    "value",
    Gio.SettingsBindFlags.DEFAULT
  );

  statusCheckFreqRow.add_suffix(statusCheckFrequencyField);
  statusCheckFreqRow.activatable_widget = statusCheckFrequencyField;
  group.add(statusCheckFreqRow);

  window._settings = settings;
}
