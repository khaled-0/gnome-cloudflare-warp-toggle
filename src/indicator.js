const { GObject, Gio } = imports.gi;

const QuickSettingsMenu = imports.ui.main.panel.statusArea.quickSettings;

const { SystemIndicator, QuickToggle } = imports.ui.quickSettings;
const { spawnCommandLine } = imports.misc.util;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const statusPattern =
  /(Connected|Connecting|Disconnected|Registration Missing)/;

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
      this.settings = ExtensionUtils.getSettings();
      this._indicator = this._addIndicator();
      this._indicator.visible = false;
      this._indicator.gicon = Gio.icon_new_for_string(
        Me.path + "/icons/cloudflare-symbolic.svg"
      );

      this._toggle = new WARPToggle();
      this._toggle.connect("clicked", () => {
        this.checkStatus();
        spawnCommandLine(
          `warp-cli ${!this._toggle.checked ? "connect" : "disconnect"}`
        );
        this.checkStatus();

        if (!this.settings.get_boolean("status-check"))
          this._manualStatusCheck = setTimeout(
            () => this.checkStatus(),
            this.settings.get_uint("status-check-freq") + 1000
          );
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

    destroy() {
      this.settings = null;
      if (this._manualStatusCheck) clearTimeout(this._manualStatusCheck);
      this._manualStatusCheck = null;
      this._indicator.destroy();
      for (const item of this.quickSettingsItems) item.destroy();
      super.destroy();
    }

    updateStatus(isActive, optionalStatus) {
      this._indicator.visible = isActive;
      this._toggle.set({ checked: isActive, subtitle: optionalStatus });
    }

    checkStatus() {
      let proc = Gio.Subprocess.new(
        ["warp-cli", "status"],
        Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
      );

      let [ok, stdout] = proc.communicate_utf8(null, null);
      if (ok) {
        const status = statusPattern.exec(stdout)?.[1];
        this.updateStatus(status == "Connected", status);
      }
    }
  }
);
