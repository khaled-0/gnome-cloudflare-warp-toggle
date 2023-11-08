const { GObject, Gio } = imports.gi;

const QuickSettingsMenu = imports.ui.main.panel.statusArea.quickSettings;

const { SystemIndicator, QuickToggle } = imports.ui.quickSettings;
const { spawnCommandLine } = imports.misc.util;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const statusPattern =
  /(Connected|Connecting|Disconnected|Registration Missing)/;

const WARPStatus = Object.freeze({
  Connected: "Connected",
  Connecting: "Connecting",
  Disconnected: "Disconnected",
  "Registration Missing": "Registration Missing",
  Error: "Error",
});

var WARPToggle = GObject.registerClass(
  class WARPToggle extends QuickToggle {
    _init() {
      super._init({
        title: "WARP",
      });

      this.label = "WARP";
      this.gicon = Gio.icon_new_for_string(
        Me.path + "/icons/cloudflare-symbolic.svg"
      );
    }
  }
);

// eslint-disable-next-line no-unused-vars
var WARPIndicator = GObject.registerClass(
  class WARPIndicator extends SystemIndicator {
    _init() {
      super._init();
      this._settings = ExtensionUtils.getSettings();
      this._indicator = this._addIndicator();
      this._indicator.visible = false;
      this._indicator.gicon = Gio.icon_new_for_string(
        Me.path + "/icons/cloudflare-symbolic.svg"
      );

      this._toggle = new WARPToggle();
      this._toggle.connect("clicked", async () => {
        if ((await this.checkStatus()) == WARPStatus.Connecting) {
          spawnCommandLine(`warp-cli disconnect`);
          await this.checkStatus();
          return;
        }

        spawnCommandLine(
          `warp-cli ${!this._toggle.checked ? "connect" : "disconnect"}`
        );

        if (!this._settings.get_boolean("status-check"))
          this.probeManualConnectionStatus();
      });

      this.quickSettingsItems.push(this._toggle);

      QuickSettingsMenu._addItems(this.quickSettingsItems);
      QuickSettingsMenu._indicators.insert_child_at_index(this, 0);

      // Ensure the tile(s) are above the background apps menu
      for (const item of this.quickSettingsItems) {
        QuickSettingsMenu.menu._grid.set_child_below_sibling(
          item,
          QuickSettingsMenu._backgroundApps.quickSettingsItems[0]
        );
      }
    }

    async probeManualConnectionStatus() {
      const status = await this.checkStatus();
      if (status == WARPStatus.Connecting) this.probeManualConnectionStatus();
    }

    destroy() {
      this._settings = null;
      this._indicator.destroy();
      for (const item of this.quickSettingsItems) item.destroy();
      super.destroy();
    }

    updateStatus(isActive, optionalStatus) {
      this._indicator.visible = isActive;
      this._toggle.set({ checked: isActive, subtitle: optionalStatus });
    }

    //Returns WARPStatus
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
