const Main = imports.ui.main
const { GLib } = imports.gi

const ExtensionUtils = imports.misc.extensionUtils
const Me = ExtensionUtils.getCurrentExtension()

const QuickSettings = Main.panel.statusArea.quickSettings

const { Indicator } = Me.imports.indicator

const statusPattern = /Status update: (Connected|Connecting|Disconnected)/

class Extension {
  constructor() {
    this._indicator = null
  }

  enable() {
    this._indicator = new Indicator()

    QuickSettings._indicators.insert_child_at_index(this._indicator, 0)
    QuickSettings._addItems(this._indicator.quickSettingsItems)

    this.startService()
  }

  disable() {
    if (this._indicator) {
      this._indicator.destroy()
      this._indicator = null
    }

    this.stopService()
  }

  startService() {
    this._interval = setInterval(() => this._update(), 1000)
  }

  _update() {
    const [, stdout, , status] = GLib.spawn_command_line_sync('warp-cli status')

    if (status === 0) {
      const s = statusPattern.exec(stdout)?.[1]

      if (!s) return this._indicator.updateStatus(null)

      this._indicator.updateStatus(s)
    } else {
      this._indicator.updateStatus('Disconnected')
    }
  }

  stopService() {
    if (!this._interval) return

    clearInterval(this._interval)
  }
}

// eslint-disable-next-line no-unused-vars
function init() {
  return new Extension()
}
