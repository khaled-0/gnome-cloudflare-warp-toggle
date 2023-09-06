import { WARPIndicator } from "./indicator.js";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";

export default class WARPToggleExtension extends Extension {
  enable() {
    this._settings = this.getSettings();
    this._indicator = new WARPIndicator(this);

    this._indicator.quickSettingsItems.push(this._indicator._toggle);
    Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);

    if (
      this._settings.get_uint("status-check-freq") > 0 &&
      this._settings.get_boolean("status-check")
    ) {
      this._timeout = setInterval(
        () => this._indicator.checkStatus(),
        this._settings.get_uint("status-check-freq") * 1000
      );
    }

    this._settings.connect("changed", (settings) => {
      if (this._timeout) clearInterval(this._timeout);
      if (
        settings.get_uint("status-check-freq") > 0 &&
        settings.get_boolean("status-check")
      )
        this._timeout = setInterval(
          () => this._indicator.checkStatus(),
          settings.get_uint("status-check-freq") * 1000
        );
    });

    this._indicator.checkStatus();
  }

  disable() {
    this._indicator.quickSettingsItems.forEach((item) => item.destroy());
    this._indicator.destroy();
    this._indicator = null;

    if (this._timeout) {
      clearInterval(this._timeout);
      this._timeout = null;
    }

    this._settings = null;
  }
}
