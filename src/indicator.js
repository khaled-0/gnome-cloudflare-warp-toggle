import Gio from "gi://Gio";
import GObject from "gi://GObject";
import * as QuickSettings from "resource:///org/gnome/shell/ui/quickSettings.js";
import {
  Ornament,
  PopupMenuItem,
} from "resource:///org/gnome/shell/ui/popupMenu.js";

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
const ACTION_TIMEOUT = 30_000;
const COMMAND_TIMEOUT = 10_000;
const WARP_MODES = [
  "warp",
  "doh",
  "warp+doh",
  "dot",
  "warp+dot",
  "proxy",
  "tunnel_only",
];
const TERMINAL_STATUSES = [
  WARPStatus.RegistrationMissing,
  WARPStatus.NoNetwork,
];

let warpCliQueue = Promise.resolve();

function runWarpCli(args, isValid, cancellable) {
  const command = warpCliQueue.then(() => {
    if (!isValid() || cancellable.is_cancelled()) return null;

    return new Promise((resolve, reject) => {
      const proc = Gio.Subprocess.new(
        ["warp-cli", ...args],
        Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
      );
      const operation = new Gio.Cancellable();
      let timedOut = false;
      const cancelId = cancellable.connect(() => {
        proc.force_exit();
        operation.cancel();
      });
      const timeout = setTimeout(() => {
        timedOut = true;
        proc.force_exit();
        operation.cancel();
      }, COMMAND_TIMEOUT);

      proc.communicate_utf8_async(null, operation, (proc, res) => {
        clearTimeout(timeout);
        cancellable.disconnect(cancelId);
        try {
          const [, stdout, stderr] = proc.communicate_utf8_finish(res);
          if (timedOut)
            reject(new Error(`warp-cli ${args.join(" ")} timed out`));
          else if (proc.get_successful()) resolve((stdout ?? "").trim());
          else
            reject(
              new Error(stderr?.trim() || `warp-cli ${args.join(" ")} failed`)
            );
        } catch (err) {
          reject(
            timedOut ? new Error(`warp-cli ${args.join(" ")} timed out`) : err
          );
        }
      });
    });
  });
  warpCliQueue = command.catch(() => {});
  return command;
}

const WARPToggle = GObject.registerClass(
  class WARPToggle extends QuickSettings.QuickMenuToggle {
    _init(extensionObject, cancellable) {
      super._init({
        title: "WARP",
        gicon: Gio.icon_new_for_string(
          extensionObject.path + "/icons/cloudflare-symbolic.svg"
        ),
        toggleMode: true,
      });
      this._cancellable = cancellable;
      this._modeItems = new Map();

      for (const mode of WARP_MODES) {
        const item = new PopupMenuItem(mode);
        item.connect("activate", async () => {
          try {
            await runWarpCli(
              ["mode", mode],
              () => !this._cancellable.is_cancelled(),
              this._cancellable
            );
            await this._updateCurrentMode();
          } catch (err) {
            if (!this._cancellable.is_cancelled()) logError(err);
          }
        });
        this.menu.addMenuItem(item);
        this._modeItems.set(mode, item);
      }

      this.menu.connect("open-state-changed", (_menu, open) => {
        if (open) this._updateCurrentMode();
      });
    }

    async _updateCurrentMode() {
      try {
        const output = await runWarpCli(
          ["--json", "settings"],
          () => !this._cancellable.is_cancelled(),
          this._cancellable
        );
        if (output === null) return;

        const mode = JSON.parse(output).settings.operation_mode;
        for (const [name, item] of this._modeItems)
          item.setOrnament(name === mode ? Ornament.CHECK : Ornament.NONE);
      } catch (err) {
        if (!this._cancellable.is_cancelled()) logError(err);
      }
    }
  }
);

export var WARPIndicator = GObject.registerClass(
  class WARPIndicator extends QuickSettings.SystemIndicator {
    _init(extensionObject) {
      super._init();
      this._cancellable = new Gio.Cancellable();
      this._indicator = this._addIndicator();
      this._indicator.gicon = Gio.icon_new_for_string(
        extensionObject.path + "/icons/cloudflare-symbolic.svg"
      );
      this._generation = 0;
      this._pendingAction = null;
      this._deadline = null;
      this._timeout = null;
      this._toggle = new WARPToggle(extensionObject, this._cancellable);
      this._toggle.connect("clicked", () =>
        this._runAction(this._toggle.checked ? "connect" : "disconnect")
      );
    }

    async _runAction(action) {
      const generation = ++this._generation;
      clearTimeout(this._timeout);
      this._timeout = null;
      this._pendingAction = action;
      this._deadline = Date.now() + ACTION_TIMEOUT;
      this._setStatus(
        this._indicator.visible,
        action === "connect" ? WARPStatus.Connecting : "Disconnecting",
        action === "connect"
      );

      try {
        await runWarpCli(
          [action],
          () => generation === this._generation && Date.now() < this._deadline,
          this._cancellable
        );
      } catch (err) {
        if (this._cancellable.is_cancelled() || generation !== this._generation)
          return;

        logError(err);
        this._pendingAction = null;
        this._deadline = null;
        await this._updateStatus(generation);
        return;
      }

      if (this._cancellable.is_cancelled() || generation !== this._generation)
        return;
      this._scheduleStatusUpdate(generation);
    }

    _scheduleStatusUpdate(generation) {
      clearTimeout(this._timeout);
      this._timeout = setTimeout(
        () => this._updateStatus(generation),
        POLL_INTERVAL
      );
    }

    async _updateStatus(generation = this._generation) {
      const status = await this._getStatus();
      if (this._cancellable.is_cancelled() || generation !== this._generation)
        return;

      const action = this._pendingAction;
      if (status === WARPStatus.Error) {
        this._toggle.subtitle = "Unable to determine status";
        if (action && Date.now() < this._deadline) {
          this._scheduleStatusUpdate(generation);
        } else if (action) {
          this._pendingAction = null;
          this._deadline = null;
          this._toggle.checked = this._indicator.visible;
        }
        return;
      }

      if (action) {
        const expected =
          action === "connect" ? WARPStatus.Connected : WARPStatus.Disconnected;
        if (status === expected || TERMINAL_STATUSES.includes(status)) {
          this._pendingAction = null;
          this._deadline = null;
        } else if (Date.now() >= this._deadline) {
          this._pendingAction = null;
          this._deadline = null;
          this._setStatus(
            status === WARPStatus.Connected,
            action === "connect"
              ? "Connection timed out"
              : "Disconnection timed out"
          );
          return;
        } else {
          this._setStatus(
            this._indicator.visible,
            action === "connect" ? WARPStatus.Connecting : "Disconnecting",
            action === "connect"
          );
          this._scheduleStatusUpdate(generation);
          return;
        }
      }

      this._setStatus(status === WARPStatus.Connected, status);
    }

    async _getStatus() {
      try {
        const output = await runWarpCli(
          ["status"],
          () => !this._cancellable.is_cancelled(),
          this._cancellable
        );
        return output === null
          ? WARPStatus.Error
          : statusPattern.exec(output)?.[1] ?? WARPStatus.Error;
      } catch {
        return WARPStatus.Error;
      }
    }

    _setStatus(isActive, subtitle, checked = isActive) {
      this._indicator.visible = isActive;
      this._toggle.set({ checked, subtitle });
    }

    async checkStatusAndUpdate() {
      await this._updateStatus();
    }

    destroy() {
      this._generation++;
      this._cancellable.cancel();
      clearTimeout(this._timeout);
      super.destroy();
    }
  }
);
