import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import { WARPIndicator } from "./indicator.js";

export default class WARPToggleExtension extends Extension {
  enable() {
    this._settings = this.getSettings();
    this._indicator = new WARPIndicator(this);

    this._indicator.quickSettingsItems.push(this._indicator._toggle);
    Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);

    this._indicator.checkStatusAndUpdate();

    if (this._settings.get_boolean("status-check")) {
      this.startStatusCheckLoop();
    }

    this._settingsChangedId = this._settings.connect("changed", (settings) => {
      if (settings.get_boolean("status-check")) {
        this.startStatusCheckLoop();
      } else {
        if (this._interval) {
          clearInterval(this._interval);
          this._interval = null;
        }
      }
    });
  }

  disable() {
    if (this._settingsChangedId) {
      this._settings.disconnect(this._settingsChangedId);
      this._settingsChangedId = null;
    }

    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }

    this._indicator.quickSettingsItems.forEach((item) => item.destroy());
    this._indicator.destroy();
    this._indicator = null;

    this._settings = null;
  }

  startStatusCheckLoop() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }

    const frequency = this._settings.get_uint("status-check-freq");
    if (frequency <= 0) return;

    this._interval = setInterval(
      () => this._indicator.checkStatusAndUpdate(),
      frequency * 1000,
    );
  }
}
