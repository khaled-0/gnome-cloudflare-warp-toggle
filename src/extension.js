const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const { WARPIndicator } = Me.imports.indicator;

class Extension {
  constructor() {
    this._indicator = null;
  }

  enable() {
    this._indicator = new WARPIndicator();
    this.settings = ExtensionUtils.getSettings();

    if (
      this.settings.get_uint("status-check-freq") > 0 &&
      this.settings.get_boolean("status-check")
    ) {
      this._timeout = setInterval(
        () => this._indicator.checkStatus(),
        this.settings.get_uint("status-check-freq") * 1000
      );
    }

    this.settings.connect("changed", (settings) => {
      if (this._timeout) clearInterval(this._timeout);
      if (
        settings.get_uint("status-check-freq") > 0 &&
        settings.get_boolean("status-check")
      )
        this._timeout = setInterval(
          () => this._indicator.checkStatus(),
          settings.get_uint("status-check-freq") * 1000
        );
    });

    this._indicator.checkStatus();
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

    this.settings = null;
  }
}

// eslint-disable-next-line no-unused-vars
function init() {
  return new Extension();
}
