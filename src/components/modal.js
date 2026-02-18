import { router } from "../router.js";
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
  } else if (modal.type === "add-tracks") {
    showAddTracksModal(wrapper, modal.data);
  } else if (modal.type === "scan-folder") {
    showScanFolderModal(wrapper);
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
      router.navigate(`#/playlist/${playlist.id}`);
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
      try {
        window.dispatchEvent(new HashChangeEvent("hashchange"));
      } catch (e) {
        window.dispatchEvent(new Event("hashchange"));
      }
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

function showAddTracksModal(wrapper, data = {}) {
  const playlistId = data.playlistId;
  const playlist = musicLibrary.getPlaylistById(playlistId);
  if (!playlist) return;

  const allTracks = musicLibrary.getAllTracks();
  const availableTracks = allTracks.filter(
    (t) => !playlist.trackIds.includes(t.id),
  );

  wrapper.style.display = "block";
  wrapper.innerHTML = `
    <div class="modal-overlay">
      <div class="modal" style="max-height: 80vh; display: flex; flex-direction: column;">
        <div class="modal-title">Add Songs to ${playlist.name}</div>
        <input class="modal-input" id="track-search-input" type="text" placeholder="Search tracks..." style="margin-bottom: var(--sp-2);">
        
        <div id="tracks-list-container" style="flex: 1; overflow-y: auto; margin-bottom: var(--sp-4); border: 1px solid var(--border-light); border-radius: var(--radius-md);">
          <!-- Tracks injected here -->
        </div>

        <div class="modal-actions">
          <button class="btn btn-primary" id="modal-done">Done</button>
        </div>
      </div>
    </div>
  `;

  const container = wrapper.querySelector("#tracks-list-container");
  const searchInput = wrapper.querySelector("#track-search-input");

  const renderList = (tracks) => {
    container.innerHTML = "";
    if (tracks.length === 0) {
      container.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--text-tertiary);">No songs available</div>`;
      return;
    }

    tracks.forEach((track) => {
      const row = createElement("div", "track-row-simple");
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.padding = "8px";
      row.style.borderBottom = "1px solid var(--border-light)";
      row.innerHTML = `
        <div style="flex: 1; overflow: hidden;">
          <div style="font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${track.title}</div>
          <div style="font-size: 11px; color: var(--text-tertiary);">${track.artist}</div>
        </div>
        <button class="btn-icon-add" style="background: var(--bg-surface); border: 1px solid var(--border-light); border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
          <svg viewBox="0 0 24 24" fill="currentColor" style="width: 16px; height: 16px;"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
        </button>
      `;

      row.querySelector(".btn-icon-add").addEventListener("click", (e) => {
        musicLibrary.addTrackToPlaylist(playlistId, track.id);
        e.currentTarget.style.background = "var(--accent)";
        e.currentTarget.style.color = "#000";
        e.currentTarget.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" style="width: 16px; height: 16px;"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`;
        e.currentTarget.disabled = true;
        store.showToast(`Added "${track.title}"`);
      });

      container.appendChild(row);
    });
  };

  renderList(availableTracks);

  searchInput.addEventListener("input", (e) => {
    const q = e.target.value.toLowerCase();
    const filtered = availableTracks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q),
    );
    renderList(filtered);
  });

  wrapper.querySelector("#modal-done").addEventListener("click", () => {
    store.set("modal", null);
    if (window.location.hash === `#/playlist/${playlistId}`) {
      try {
        window.dispatchEvent(new HashChangeEvent("hashchange"));
      } catch (e) {
        window.dispatchEvent(new Event("hashchange"));
      }
    }
  });

  wrapper.querySelector(".modal-overlay").addEventListener("click", (e) => {
    if (e.target.classList.contains("modal-overlay")) {
      store.set("modal", null);
      if (window.location.hash === `#/playlist/${playlistId}`) {
        try {
          window.dispatchEvent(new HashChangeEvent("hashchange"));
        } catch (e) {
          window.dispatchEvent(new Event("hashchange"));
        }
      }
    }
  });
}

function showScanFolderModal(wrapper) {
  wrapper.style.display = "block";
  wrapper.innerHTML = `
    <div class="modal-overlay">
      <div class="modal">
        <div class="modal-title">Add Music Folder</div>
        <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 12px;">
          Enter the full path to your music folder on the device.
        </div>
        <input class="modal-input" id="folder-path-input" type="text" placeholder="/storage/emulated/0/Music" value="/storage/emulated/0/Music">
        
        <div class="modal-actions">
          <button class="btn btn-secondary" id="scan-cancel">Cancel</button>
          <button class="btn btn-primary" id="scan-confirm">Scan</button>
        </div>
      </div>
    </div>
  `;

  const input = wrapper.querySelector("#folder-path-input");

  const scan = async () => {
    const path = input.value.trim();
    if (path) {
      const btn = wrapper.querySelector("#scan-confirm");
      const originalText = btn.textContent;
      btn.textContent = "Scanning...";
      btn.disabled = true;

      try {
        await musicLibrary.addScanDirectory(path);
        store.set("modal", null);
      } catch (e) {
        store.showToast("Scan Error");
        btn.textContent = originalText;
        btn.disabled = false;
      }
    }
  };

  wrapper.querySelector("#scan-cancel").addEventListener("click", () => {
    store.set("modal", null);
  });

  wrapper.querySelector("#scan-confirm").addEventListener("click", scan);

  wrapper.querySelector(".modal-overlay").addEventListener("click", (e) => {
    if (e.target.classList.contains("modal-overlay")) {
      store.set("modal", null);
    }
  });
}
