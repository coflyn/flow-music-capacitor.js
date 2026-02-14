class Store {
  constructor() {
    this.state = {
      currentView: "home",
      nowPlayingOpen: false,
      contextMenu: null,
      modal: null,
      toast: null,
    };
    this._listeners = {};
  }

  get(key) {
    return this.state[key];
  }

  set(key, value) {
    this.state[key] = value;
    this._emit(key, value);
    this._emit("change", { key, value });
  }

  on(event, callback) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(callback);
  }

  off(event, callback) {
    if (!this._listeners[event]) return;
    this._listeners[event] = this._listeners[event].filter(
      (cb) => cb !== callback,
    );
  }

  _emit(event, data) {
    if (this._listeners[event]) {
      this._listeners[event].forEach((cb) => cb(data));
    }
  }

  showToast(message) {
    this.set("toast", { message });
    setTimeout(() => this.set("toast", null), 2500);
  }
}

export const store = new Store();
