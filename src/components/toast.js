import { store } from "../core/store.js";
import { createElement } from "../core/utils.js";

export function createToast() {
  const el = createElement("div", "toast");
  el.id = "toast";

  store.on("toast", (t) => {
    if (t) {
      el.textContent = t.message;
      el.classList.add("show");
    } else {
      el.classList.remove("show");
    }
  });

  return el;
}
