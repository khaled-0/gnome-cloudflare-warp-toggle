const { GObject, Gio } = imports.gi

const { SystemIndicator, QuickToggle } = imports.ui.quickSettings
const { GLib } = imports.gi

const ExtensionUtils = imports.misc.extensionUtils
const Me = ExtensionUtils.getCurrentExtension()

const icon = Gio.icon_new_for_string(Me.path + '/icons/cloudflare.svg')

const WarpToggle = GObject.registerClass(
  class WarpToggle extends QuickToggle {
    _init() {
      super._init({
        label: 'WARP',
        gicon: icon,
      })

      this.connectObject('clicked', () => this._toggle(), this)
    }

    _toggle() {
      if (this.checked) {
        GLib.spawn_command_line_sync('warp-cli disconnect')
      } else {
        GLib.spawn_command_line_sync('warp-cli connect')
      }

      this.set({ checked: !this.checked })
    }
  }
)

// eslint-disable-next-line no-unused-vars
var Indicator = GObject.registerClass(
  class Indicator extends SystemIndicator {
    _init() {
      super._init()

      this._indicator = this._addIndicator()

      this._indicator.gicon = icon

      this._indicator.visible = false

      this.quickSettingsItems.push((this._toggle = new WarpToggle()))
    }

    destroy() {
      this._indicator.destroy()

      for (const item of this.quickSettingsItems) {
        item.destroy()
      }

      super.destroy()
    }

    updateStatus(status) {
      const enabled = status === 'Connected'

      this._indicator.visible = enabled

      this._toggle.set({ checked: enabled })
    }
  }
)
