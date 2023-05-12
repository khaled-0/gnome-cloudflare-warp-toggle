const { Gio } = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const { Indicator } = Me.imports.indicator;
const { setError, clearError } = Me.imports.util;

const statusPattern =
  /Status update: (Connected|Connecting|Disconnected|Registration missing)/;

class Extension {
  constructor() {
    this._indicator = null;
  }

  enable() {
    this._indicator = new Indicator();
    this.startService();
  }

  disable() {
    if (this._indicator) {
      this._indicator.destroy();
      this._indicator = null;
    }

    this.stopService();
  }

  _update() {
    const proc = Gio.Subprocess.new(
      ["warp-cli", "status"],
      Gio.SubprocessFlags.STDOUT_PIPE
    );

    proc.communicate_utf8_async(null, null, (proc, res) => {
      const [, stdout] = proc.communicate_utf8_finish(res);

      if (proc.get_successful()) {
        clearError("warp-not-running");

        const status = statusPattern.exec(stdout)?.[1];
        this._indicator.updateStatus(status);

        if (status === "Registration missing") {
          setError(
            "registration-missing",
            'Registration is missing.\nTry running "warp-cli register"'
          );
        } else {
          clearError("registration-missing");
        }
      } else {
        this._indicator.updateStatus(null);

        setError(
          "warp-not-running",
          `Unable to check if WARP is running. Did you start the service?\nIf not, try running "sudo systemctl start warp-svc.service"`
        );
      }

      setTimeout(() => this._update(), 1000);
    });
  }

  startService() {
    this._timeout = setTimeout(() => this._update(), 1000);
  }
  stopService() {
    if (this._timeout) clearInterval(this._timeout);
  }
}

function init() {
  return new Extension();
}
