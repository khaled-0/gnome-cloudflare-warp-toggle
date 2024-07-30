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

    if (this.settings.get_boolean("status-check")) {
      this.startStatusCheckLoop();
    } else {
      this._indicator.checkStatusAndUpdate();
    }

    this.settings.connect("changed", (settings) => {
      if (settings.get_boolean("status-check")) {
        this.startStatusCheckLoop();
      } else {
        if (this._interval) clearInterval(this._interval);
      }
    });
  }

  disable() {
    if (this._indicator) {
      this._indicator.destroy();
      this._indicator = null;
    }

    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }

    this.settings = null;
  }

  startStatusCheckLoop() {
    if (this._interval) clearInterval(this._interval);
    if (this.settings.get_uint("status-check-freq") <= 0) return;

    this._interval = setInterval(
      () => this._indicator.checkStatusAndUpdate(),
      this.settings.get_uint("status-check-freq") * 1000
    );
  }
}

// eslint-disable-next-line no-unused-vars
function init() {
  return new Extension();
}
