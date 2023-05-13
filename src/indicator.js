const { GObject, Gio } = imports.gi;

const QuickSettingsMenu = imports.ui.main.panel.statusArea.quickSettings;

const { SystemIndicator, QuickToggle } = imports.ui.quickSettings;
const { spawnCommandLine } = imports.misc.util;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const WarpToggle = GObject.registerClass(
  class WarpToggle extends QuickToggle {
    _init() {
      super._init({
        title: "Cloudflare WARP",
      });

      this.label = "Cloudflare WARP";
      this.gicon = Gio.icon_new_for_string(
        Me.path + "/icons/cloudflare-symbolic.svg"
      );

      this.connect("clicked", () => {
        if (this.checked) {
          spawnCommandLine("warp-cli disconnect");
        } else {
          spawnCommandLine("warp-cli connect");
        }
      });
    }
  }
);

// eslint-disable-next-line no-unused-vars
var Indicator = GObject.registerClass(
  class Indicator extends SystemIndicator {
    _init() {
      super._init();
      this._indicator = this._addIndicator();
      this._indicator.visible = false;
      this._indicator.gicon = Gio.icon_new_for_string(
        Me.path + "/icons/cloudflare-symbolic.svg"
      );

      this._toggle = new WarpToggle();
      this.quickSettingsItems.push(this._toggle);

      // Add the indicator to the panel and the toggle to the menu
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
      this._indicator.destroy();
      for (const item of this.quickSettingsItems) item.destroy();
      super.destroy();
    }

    updateStatus(status) {
      const enabled = status === "Connected" || status === "Connecting";

      this._indicator.visible = enabled;
      this._toggle.set({ checked: enabled });
    }
  }
);
