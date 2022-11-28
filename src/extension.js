const Main = imports.ui.main
const { Gio } = imports.gi

const ExtensionUtils = imports.misc.extensionUtils
const Me = ExtensionUtils.getCurrentExtension()

const QuickSettings = Main.panel.statusArea.quickSettings

const { Indicator } = Me.imports.indicator
const { setError, clearError } = Me.imports.util

const statusPattern =
  /Status update: (Connected|Connecting|Disconnected|Registration missing)/

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
    this._timeout = setTimeout(() => this._update(), 1000)
  }

  _update() {
    const proc = Gio.Subprocess.new(
      ['warp-cli', 'status'],
      Gio.SubprocessFlags.STDOUT_PIPE
    )

    proc.communicate_utf8_async(null, null, (proc, res) => {
      const [, stdout] = proc.communicate_utf8_finish(res)

      if (proc.get_successful()) {
        clearError('warp-not-running')

        const s = statusPattern.exec(stdout)?.[1]
        if (!s) this._indicator.updateStatus(null)
        else this._indicator.updateStatus(s)
      } else {
        this._indicator.updateStatus(null)

        setError(
          'warp-not-running',
          `Unable to check if WARP is running. Did you start the service?\nIf not, try running "sudo systemctl start warp-svc.service"`
        )
      }

      setTimeout(() => this._update(), 1000)
    })

    // if (status === 0) {
    //   const s = statusPattern.exec(out)?.[1]
    //   if (!s) return this._indicator.updateStatus(null)
    //   this._indicator.updateStatus(s)
    // } else {
    //   this._indicator.updateStatus('Disconnected')
    // }
  }

  stopService() {
    if (!this._timeout) return

    clearInterval(this._timeout)
  }
}

// eslint-disable-next-line no-unused-vars
function init() {
  return new Extension()
}
