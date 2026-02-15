import { store } from "./core/store.js";

class Router {
  constructor() {
    this.routes = {};
    this.currentRoute = null;
    this.params = {};
    window.addEventListener("hashchange", () => this._resolve());
  }

  register(path, handler) {
    this.routes[path] = handler;
  }

  navigate(path) {
    window.location.hash = path;
  }

  init() {
    if (!window.location.hash) {
      window.location.hash = "#/";
    } else {
      this._resolve();
    }
  }

  _resolve() {
    const hash = window.location.hash || "#/";

    if (this.routes[hash]) {
      this.params = {};
      this.currentRoute = hash;
      store.set("currentView", hash);

      const main = document.getElementById("main-content");
      if (main) {
        main.classList.remove("view-enter");
        void main.offsetWidth;
        main.classList.add("view-enter");
      }

      this.routes[hash](this.params);
      return;
    }

    const parts = hash.split("/").filter(Boolean);

    for (const [pattern, handler] of Object.entries(this.routes)) {
      const patternParts = pattern.split("/").filter(Boolean);
      if (patternParts.length !== parts.length) continue;

      const params = {};
      let match = true;
      for (let i = 0; i < patternParts.length; i++) {
        if (patternParts[i].startsWith(":")) {
          params[patternParts[i].slice(1)] = parts[i];
        } else if (patternParts[i] !== parts[i]) {
          match = false;
          break;
        }
      }

      if (match) {
        this.params = params;
        this.currentRoute = hash;
        store.set("currentView", hash);

        const main = document.getElementById("main-content");
        if (main) {
          main.classList.remove("view-enter");
          void main.offsetWidth;
          main.classList.add("view-enter");
        }

        handler(params);
        return;
      }
    }

    this.navigate("#/");
  }
}

export const router = new Router();
