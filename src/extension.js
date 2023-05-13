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
    this._timeout = setTimeout(() => this._update(), 1000);
  }

  disable() {
    if (this._indicator) {
      this._indicator.destroy();
      this._indicator = null;
    }

    if (this._timeout) {
      clearInterval(this._timeout);
      this._timeout = null;
    }
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
}

// eslint-disable-next-line no-unused-vars
function init() {
  return new Extension();
}
