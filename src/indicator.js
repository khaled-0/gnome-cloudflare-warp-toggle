import Gio from "gi://Gio";
import GObject from "gi://GObject";
import * as QuickSettings from "resource:///org/gnome/shell/ui/quickSettings.js";
import { spawnCommandLine } from "resource:///org/gnome/shell/misc/util.js";

const statusPattern =
  /(Connected|Connecting|Disconnected|Registration Missing)/;

const WARPToggle = GObject.registerClass(
  class WARPToggle extends QuickSettings.QuickToggle {
    _init(extensionObject) {
      super._init({
        title: "WARP",
        gicon: Gio.icon_new_for_string(
          extensionObject.path + "/icons/cloudflare-symbolic.svg"
        ),
      });
    }
  }
);

export var WARPIndicator = GObject.registerClass(
  class WARPIndicator extends QuickSettings.SystemIndicator {
    _init(extensionObject) {
      super._init();
      this._indicator = this._addIndicator();
      this._settings = extensionObject.getSettings();
      this._indicator.visible = false;
      this._indicator.gicon = Gio.icon_new_for_string(
        extensionObject.path + "/icons/cloudflare-symbolic.svg"
      );

      //Create a Toggle for QuickSettings
      this._toggle = new WARPToggle(extensionObject);
      this._toggle.connect("clicked", () => {
        this.checkStatus();
        spawnCommandLine(
          `warp-cli ${!this._toggle.checked ? "connect" : "disconnect"}`
        );
        this.checkStatus();

        if (!this._settings.get_boolean("status-check"))
          this._manualStatusCheck = setTimeout(
            () => this.checkStatus(),
            this._settings.get_uint("status-check-freq") + 1000
          );
      });
    }

    destroy() {
      this._settings = null;
      if (this._manualStatusCheck) clearTimeout(this._manualStatusCheck);
      this._manualStatusCheck = null;
      this._indicator.destroy();
      super.destroy();
    }

    updateStatus(isActive, optionalStatus) {
      this._indicator.visible = isActive;
      this._toggle.set({ checked: isActive, subtitle: optionalStatus });
    }

    checkStatus() {
      try {
        let proc = Gio.Subprocess.new(
          ["warp-cli", "status"],
          Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
        );

        let [ok, stdout] = proc.communicate_utf8(null, null);
        if (ok) {
          const status = statusPattern.exec(stdout)?.[1];
          this.updateStatus(status == "Connected", status);
        }
      } catch (err) {
        this.updateStatus(false, "Error");
        logError(err);
      }
    }
  }
);
