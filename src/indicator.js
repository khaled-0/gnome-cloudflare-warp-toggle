import Gio from "gi://Gio";
import GObject from "gi://GObject";
import { spawnCommandLine } from "resource:///org/gnome/shell/misc/util.js";
import * as QuickSettings from "resource:///org/gnome/shell/ui/quickSettings.js";

const statusPattern =
  /(Connected|Connecting|Disconnected|Registration Missing|No Network)/;

const WARPStatus = Object.freeze({
  Connected: "Connected",
  Connecting: "Connecting",
  Disconnected: "Disconnected",
  "Registration Missing": "Registration Missing",
  "No Network": "No Network",
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
        if ((await this.checkStatusAndUpdate()) == WARPStatus.Connecting) {
          spawnCommandLine(`warp-cli disconnect`);
          await this.checkStatusAndUpdate();
          return;
        }

        spawnCommandLine(
          `warp-cli ${!this._toggle.checked ? "connect" : "disconnect"}`
        );

        if (!this._settings.get_boolean("status-check"))
          this.updateStatusWhileConnecting();
      });
    }

    async updateStatusWhileConnecting() {
      if ((await this.checkStatusAndUpdate()) != WARPStatus.Connecting) {
        clearTimeout(this._timeout);
        this._timeout = null;
        return;
      }

      //Checking every second while connecting. Prevents excessive CPU usage
      this._timeout = setTimeout(
        () => this.updateStatusWhileConnecting(),
        1000
      );
    }

    destroy() {
      this._settings = null;
      if (this._timeout) clearTimeout(this._timeout);
      this._timeout = null;
      this._indicator.destroy();
      super.destroy();
    }

    setStatus(isActive, optionalStatus) {
      this._indicator.visible = isActive;
      this._toggle.set({ checked: isActive, subtitle: optionalStatus });
    }

    async checkStatusAndUpdate() {
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
        this.setStatus(status == WARPStatus.Connected, status);
        return WARPStatus[status];
      } catch (err) {
        this.setStatus(false, WARPStatus.Error);
        logError(err);
        return WARPStatus.Error;
      }
    }
  }
);
