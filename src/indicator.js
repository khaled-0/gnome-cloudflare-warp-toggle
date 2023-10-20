import Gio from "gi://Gio";
import GObject from "gi://GObject";
import * as QuickSettings from "resource:///org/gnome/shell/ui/quickSettings.js";
import { spawnCommandLine } from "resource:///org/gnome/shell/misc/util.js";

const statusPattern =
  /(Connected|Connecting|Disconnected|Registration Missing)/;

const WARPStatus = Object.freeze({
  Connected: "Connected",
  Connecting: "Connecting",
  Disconnected: "Disconnected",
  "Registration Missing": "Registration Missing",
  Error: "Error",
});

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
      this._toggle.connect("clicked", async () => {
        if ((await this.checkStatus()) == WARPStatus.Connecting) return;
        spawnCommandLine(
          `warp-cli ${!this._toggle.checked ? "connect" : "disconnect"}`
        );

        if (!this.settings.get_boolean("status-check"))
          this.probeManualConnectionStatus();
      });
    }

    async probeManualConnectionStatus() {
      const status = await this.checkStatus();
      if (status == WARPStatus.Connecting) this.probeManualConnectionStatus();
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

    async checkStatus() {
      try {
        const proc = Gio.Subprocess.new(
          ["warp-cli", "status"],
          Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
        );

        const stdout = await new Promise((resolve, reject) => {
          proc.communicate_utf8_async(null, null, (proc, res) => {
            let [, stdout, stderr] = proc.communicate_utf8_finish(res);
            if (proc.get_successful()) resolve(stdout);
            reject(stderr);
          });
        });

        const status = statusPattern.exec(stdout)?.[1];
        this.updateStatus(status == WARPStatus.Connected, status);
        return WARPStatus[status];
      } catch (err) {
        this.updateStatus(false, WARPStatus.Error);
        logError(err);
        return WARPStatus.Error;
      }
    }
  }
);
