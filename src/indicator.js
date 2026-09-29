import Gio from "gi://Gio";
import GObject from "gi://GObject";
import { spawnCommandLine } from "resource:///org/gnome/shell/misc/util.js";
import * as QuickSettings from "resource:///org/gnome/shell/ui/quickSettings.js";

const statusPattern =
  /(Connected|Connecting|Disconnected|Registration Missing|No Network)/;

const WARPStatus = {
  Connected: "Connected",
  Connecting: "Connecting",
  Disconnected: "Disconnected",
  RegistrationMissing: "Registration Missing",
  NoNetwork: "No Network",
  Error: "Error",
};

const POLL_INTERVAL = 1000;
const MAX_ATTEMPTS = 30;
const TERMINAL_STATUSES = [
  WARPStatus.Error,
  WARPStatus.RegistrationMissing,
  WARPStatus.NoNetwork,
];

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
      const icon = Gio.icon_new_for_string(
        extensionObject.path + "/icons/cloudflare-symbolic.svg"
      );
      this._indicator = this._addIndicator();
      this._settings = extensionObject.getSettings();
      this._indicator.visible = false;
      this._indicator.gicon = icon;

      this._timeout = null;
      this._generation = 0;
      this._pendingAction = null;
      this._destroyed = false;

      this._toggle = new WARPToggle(extensionObject);

      this._toggle.connect("clicked", () => {
        if (this._pendingAction === "disconnect") return;

        if (this._pendingAction === "connect" || this._toggle.checked) {
          this._runAction("disconnect");
        } else {
          this._runAction("connect");
        }
      });
    }

    _isActionFinished(action, status) {
      const expectedStatus =
        action === "connect" ? WARPStatus.Connected : WARPStatus.Disconnected;

      return status === expectedStatus || TERMINAL_STATUSES.includes(status);
    }

    _stopPolling() {
      this._generation++;

      if (this._timeout !== null) {
        clearTimeout(this._timeout);
        this._timeout = null;
      }
    }

    _runAction(action) {
      this._stopPolling();
      this._pendingAction = action;

      // Update the UI immediately, without waiting for warp-cli.
      this.setStatus(
        false,
        action === "connect" ? WARPStatus.Connecting : "Disconnecting"
      );

      try {
        spawnCommandLine(`warp-cli ${action}`);
      } catch (err) {
        this._pendingAction = null;
        this.setStatus(false, WARPStatus.Error);
        logError(err);
        return;
      }

      const generation = this._generation;

      if (!this._settings.get_boolean("status-check")) {
        // Give warp-cli a moment to initiate the operation.
        this._timeout = setTimeout(() => this._pollStatus(generation, 0), 1000);
      }
    }

    async _pollStatus(generation, attempt) {
      if (this._destroyed || generation !== this._generation) return;

      this._timeout = null;

      const status = await this.getStatus();

      // An old subprocess must not update a newer operation.
      if (this._destroyed || generation !== this._generation) return;

      const action = this._pendingAction;

      if (this._isActionFinished(action, status)) {
        this._finishStatus(status);
        return;
      }

      if (attempt >= MAX_ATTEMPTS) {
        this._pendingAction = null;
        this._stopPolling();

        this.setStatus(
          status === WARPStatus.Connected,
          action === "connect"
            ? "Connection timed out"
            : "Disconnection timed out"
        );

        return;
      }

      // Keep the optimistic state.
      // Disconnected during connection is not necessarily a failure.
      this.setStatus(
        false,
        action === "connect" ? WARPStatus.Connecting : "Disconnecting"
      );

      this._timeout = setTimeout(
        () => this._pollStatus(generation, attempt + 1),
        POLL_INTERVAL
      );
    }

    _finishStatus(status) {
      this._pendingAction = null;
      this._stopPolling();

      this.setStatus(status === WARPStatus.Connected, status);
    }

    setStatus(isActive, optionalStatus) {
      this._indicator.visible = isActive;

      this._toggle.set({
        checked: isActive,
        subtitle: optionalStatus,
      });
    }

    // Retrieves the actual status without modifying the UI.
    async getStatus() {
      try {
        const proc = Gio.Subprocess.new(
          ["warp-cli", "status"],
          Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
        );

        const stdout = await new Promise((resolve, reject) => {
          proc.communicate_utf8_async(null, null, (proc, res) => {
            try {
              const [, stdout, stderr] = proc.communicate_utf8_finish(res);

              if (proc.get_successful()) resolve(stdout);
              else reject(new Error(stderr || "warp-cli status failed"));
            } catch (err) {
              reject(err);
            }
          });
        });

        const status = statusPattern.exec(stdout)?.[1] ?? WARPStatus.Error;

        return status;
      } catch (err) {
        logError(err);
        return WARPStatus.Error;
      }
    }

    // Safe to call from an external periodic status checker.
    async checkStatusAndUpdate() {
      const generation = this._generation;

      const status = await this.getStatus();

      if (this._destroyed || generation !== this._generation) return;

      // Don't overwrite an optimistic transitional state
      // with an intermediate CLI result.
      if (this._pendingAction) {
        const action = this._pendingAction;

        if (this._isActionFinished(action, status)) this._finishStatus(status);

        return;
      }

      this.setStatus(status === WARPStatus.Connected, status);
    }

    destroy() {
      this._destroyed = true;
      this._stopPolling();

      this._pendingAction = null;
      this._settings = null;

      super.destroy();
    }
  }
);
