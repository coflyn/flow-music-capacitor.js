import { icons } from "../core/icons.js";
import { musicLibrary } from "../core/library.js";
import { queueManager } from "../core/queue.js";
import { audioEngine } from "../core/audioEngine.js";
import { store } from "../core/store.js";
import { createElement, formatTime } from "../core/utils.js";
import { renderTrackList } from "../components/trackList.js";

export function renderPlaylist(container, params) {
  container.innerHTML = "";
  const playlist = musicLibrary.getPlaylistById(params.id);
  if (!playlist) {
    container.innerHTML =
      '<div class="page"><div class="empty-state"><div class="empty-state-title">Playlist not found</div></div></div>';
    return;
  }

  const tracks = musicLibrary.getPlaylistTracks(playlist.id);
  const totalDuration = tracks.reduce((sum, t) => sum + t.duration, 0);
  const coverArt = playlist.cover || tracks[0]?.cover || "";

  const page = createElement("div", "page playlist-page");

  page.innerHTML = `
    <div class="page-header">
      <div class="page-header-bg"></div>
      <div style="position: relative; cursor: pointer;" id="playlist-cover-wrapper">
        ${
          coverArt
            ? `<img class="page-header-art" id="playlist-cover-img" src="${coverArt}" alt="${playlist.name}">`
            : `<div class="page-header-art" id="playlist-cover-img" style="display:flex;align-items:center;justify-content:center;background:var(--bg-highlight);color:var(--text-tertiary)">${icons.music}</div>`
        }
        <div style="position:absolute;bottom:4px;right:4px;width:28px;height:28px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;">
          <svg viewBox="0 0 24 24" fill="white" style="width:16px;height:16px;"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
        </div>
      </div>
      <div class="page-header-info">
        <div class="page-header-type">Playlist</div>
        <h1 class="page-header-title">${playlist.name}</h1>
        <div class="page-header-meta">
          <span>${tracks.length} songs</span>
          ${totalDuration > 0 ? `<span class="page-header-dot"></span><span>${formatTime(totalDuration)}</span>` : ""}
        </div>
      </div>
    </div>

    <div class="action-bar">
      ${
        tracks.length > 0
          ? `
        <button class="action-btn-play" id="play-playlist">${icons.play}</button>
        <button class="action-btn" id="shuffle-playlist">${icons.shuffle}</button>
      `
          : ""
      }
      <button class="action-btn" id="rename-playlist" title="Rename playlist">
        <svg viewBox="0 0 24 24" fill="currentColor" style="width:20px;height:20px;"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
      </button>
      <button class="action-btn" id="delete-playlist" style="margin-left: auto;" title="Delete playlist">${icons.remove}</button>
    </div>

    <div id="playlist-tracks"></div>
  `;

  container.appendChild(page);

  page
    .querySelector("#playlist-cover-wrapper")
    .addEventListener("click", () => {
      showCoverPicker(playlist, tracks);
    });

  const playBtn = page.querySelector("#play-playlist");
  if (playBtn) {
    playBtn.addEventListener("click", () => {
      queueManager.playAll(tracks, 0);
      musicLibrary.addToRecent(tracks[0].id);
    });
  }

  const shuffleBtn = page.querySelector("#shuffle-playlist");
  if (shuffleBtn) {
    shuffleBtn.addEventListener("click", () => {
      if (!audioEngine.shuffleMode) {
        queueManager.toggleShuffle();
      }
      const randomIndex = Math.floor(Math.random() * tracks.length);
      queueManager.playAll(tracks, randomIndex);
    });
  }

  page.querySelector("#rename-playlist").addEventListener("click", () => {
    store.set("modal", {
      type: "rename-playlist",
      data: { playlist },
    });
  });

  page.querySelector("#delete-playlist").addEventListener("click", () => {
    musicLibrary.deletePlaylist(playlist.id);
    store.showToast(`Deleted "${playlist.name}"`);
    window.location.hash = "#/library";
  });

  if (tracks.length > 0) {
    renderTrackList(tracks, page.querySelector("#playlist-tracks"));

    const addMoreBtn = createElement("button", "btn btn-secondary");
    addMoreBtn.style.margin = "var(--sp-4) auto";
    addMoreBtn.style.display = "block";
    addMoreBtn.textContent = "Add More Songs";
    addMoreBtn.addEventListener("click", () => {
      store.set("modal", {
        type: "add-tracks",
        data: { playlistId: playlist.id },
      });
    });
    page.querySelector("#playlist-tracks").appendChild(addMoreBtn);
  } else {
    page.querySelector("#playlist-tracks").innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${icons.music}</div>
        <div class="empty-state-title">Empty playlist</div>
        <div class="empty-state-text">Start building your collection</div>
        <button class="btn btn-primary" id="empty-add-songs-btn" style="margin-top: var(--sp-4);">Add Songs</button>
      </div>
    `;
    page.querySelector("#empty-add-songs-btn").addEventListener("click", () => {
      store.set("modal", {
        type: "add-tracks",
        data: { playlistId: playlist.id },
      });
    });
  }
}

function showCoverPicker(playlist, tracks) {
  const allTracks = musicLibrary.getAllTracks();
  const covers = [];
  const seen = new Set();

  tracks.forEach((t) => {
    if (t.cover && !seen.has(t.cover)) {
      seen.add(t.cover);
      covers.push({ cover: t.cover, label: `${t.title} - ${t.artist}` });
    }
  });

  allTracks.forEach((t) => {
    if (t.cover && !seen.has(t.cover)) {
      seen.add(t.cover);
      covers.push({ cover: t.cover, label: `${t.title} - ${t.artist}` });
    }
  });

  const wrapper = document.getElementById("modal-wrapper");
  if (!wrapper) return;

  wrapper.style.display = "block";
  wrapper.innerHTML = `
    <div class="modal-overlay">
      <div class="modal" style="max-height: 80vh; overflow-y: auto;">
        <div class="modal-title">Choose Cover</div>
        
        <div style="margin-bottom: var(--sp-4);">
            <button class="btn btn-secondary" id="gallery-pick-btn" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;">
                <svg viewBox="0 0 24 24" fill="currentColor" style="width: 20px; height: 20px;"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>
                Choose from Gallery
            </button>
            <input type="file" id="cover-file-input" accept="image/*" style="display: none;">
        </div>

        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; padding: 8px 0;">
          ${covers
            .slice(0, 30)
            .map(
              (c, i) => `
            <div class="cover-picker-item" data-idx="${i}" style="cursor:pointer;border-radius:8px;overflow:hidden;aspect-ratio:1;position:relative;">
              <img src="${c.cover}" alt="" style="width:100%;height:100%;object-fit:cover;" loading="lazy">
            </div>
          `,
            )
            .join("")}
        </div>
      </div>
    </div>
  `;

  wrapper.querySelector(".modal-overlay").addEventListener("click", (e) => {
    if (e.target.classList.contains("modal-overlay")) {
      wrapper.style.display = "none";
      wrapper.innerHTML = "";
    }
  });

  const fileInput = wrapper.querySelector("#cover-file-input");
  wrapper.querySelector("#gallery-pick-btn").addEventListener("click", () => {
    fileInput.click();
  });

  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      musicLibrary.updatePlaylistCover(playlist.id, reader.result);
      store.showToast("Cover updated! 🎨");
      wrapper.style.display = "none";
      wrapper.innerHTML = "";
      const container = document.getElementById("main-content");
      if (container) renderPlaylist(container, { id: playlist.id });
    };
    reader.readAsDataURL(file);
  });

  wrapper.querySelectorAll(".cover-picker-item").forEach((item) => {
    item.addEventListener("click", () => {
      const idx = parseInt(item.dataset.idx);
      const selected = covers[idx];
      musicLibrary.updatePlaylistCover(playlist.id, selected.cover);
      store.showToast("Cover updated! 🎨");
      wrapper.style.display = "none";
      wrapper.innerHTML = "";
      const container = document.getElementById("main-content");
      if (container) renderPlaylist(container, { id: playlist.id });
    });
  });
}
