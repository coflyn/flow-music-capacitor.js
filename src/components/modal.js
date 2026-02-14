import { store } from "../core/store.js";
import { musicLibrary } from "../core/library.js";
import { createElement } from "../core/utils.js";

export function createModal() {
  const wrapper = createElement("div", "");
  wrapper.id = "modal-wrapper";
  wrapper.style.display = "none";

  store.on("modal", (modal) => {
    if (modal) {
      showModal(wrapper, modal);
    } else {
      wrapper.style.display = "none";
      wrapper.innerHTML = "";
    }
  });

  return wrapper;
}

function showModal(wrapper, modal) {
  if (modal.type === "create-playlist") {
    showCreatePlaylistModal(wrapper, modal.data);
  } else if (modal.type === "rename-playlist") {
    showRenamePlaylistModal(wrapper, modal.data);
  } else if (modal.content) {
    showContentModal(wrapper, modal);
  }
}

function showContentModal(wrapper, modal) {
  wrapper.style.display = "block";
  wrapper.innerHTML = `
    <div class="modal-overlay">
      <div class="modal">
        ${modal.title ? `<div class="modal-title">${modal.title}</div>` : ""}
        <div id="modal-content-slot"></div>
      </div>
    </div>
  `;

  const slot = wrapper.querySelector("#modal-content-slot");
  if (modal.content instanceof HTMLElement) {
    slot.appendChild(modal.content);
  } else {
    slot.innerHTML = modal.content;
  }

  wrapper.querySelector(".modal-overlay").addEventListener("click", (e) => {
    if (e.target.classList.contains("modal-overlay")) {
      store.set("modal", null);
    }
  });
}

function showCreatePlaylistModal(wrapper, data = {}) {
  wrapper.style.display = "block";
  wrapper.innerHTML = `
    <div class="modal-overlay">
      <div class="modal">
        <div class="modal-title">Create Playlist</div>
        <input class="modal-input" id="playlist-name-input" type="text" placeholder="Playlist name" autofocus>
        <div class="modal-actions">
          <button class="btn btn-secondary" id="modal-cancel">Cancel</button>
          <button class="btn btn-primary" id="modal-create">Create</button>
        </div>
      </div>
    </div>
  `;

  const input = wrapper.querySelector("#playlist-name-input");
  setTimeout(() => input.focus(), 100);

  const create = () => {
    const name = input.value.trim();
    if (name) {
      const playlist = musicLibrary.createPlaylist(name);
      if (data.trackToAdd) {
        musicLibrary.addTrackToPlaylist(playlist.id, data.trackToAdd);
      }
      store.showToast(`Created "${name}"`);
      store.set("modal", null);
    }
  };

  wrapper.querySelector("#modal-cancel").addEventListener("click", () => {
    store.set("modal", null);
  });

  wrapper.querySelector("#modal-create").addEventListener("click", create);

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") create();
    if (e.key === "Escape") store.set("modal", null);
  });

  wrapper.querySelector(".modal-overlay").addEventListener("click", (e) => {
    if (e.target.classList.contains("modal-overlay")) {
      store.set("modal", null);
    }
  });
}

function showRenamePlaylistModal(wrapper, data = {}) {
  const playlist = data.playlist;
  if (!playlist) return;

  wrapper.style.display = "block";
  wrapper.innerHTML = `
    <div class="modal-overlay">
      <div class="modal">
        <div class="modal-title">Rename Playlist</div>
        <input class="modal-input" id="rename-input" type="text" value="${playlist.name}" autofocus>
        <div class="modal-actions">
          <button class="btn btn-secondary" id="rename-cancel">Cancel</button>
          <button class="btn btn-primary" id="rename-save">Save</button>
        </div>
      </div>
    </div>
  `;

  const input = wrapper.querySelector("#rename-input");
  setTimeout(() => {
    input.focus();
    input.select();
  }, 100);

  const save = () => {
    const name = input.value.trim();
    if (name) {
      musicLibrary.renamePlaylist(playlist.id, name);
      store.showToast(`Renamed to "${name}"`);
      store.set("modal", null);
      window.location.hash = `#/playlist/${playlist.id}`;
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    }
  };

  wrapper.querySelector("#rename-cancel").addEventListener("click", () => {
    store.set("modal", null);
  });

  wrapper.querySelector("#rename-save").addEventListener("click", save);

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") save();
    if (e.key === "Escape") store.set("modal", null);
  });

  wrapper.querySelector(".modal-overlay").addEventListener("click", (e) => {
    if (e.target.classList.contains("modal-overlay")) {
      store.set("modal", null);
    }
  });
}
