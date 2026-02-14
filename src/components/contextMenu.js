import { icons } from "../core/icons.js";
import { musicLibrary } from "../core/library.js";
import { queueManager } from "../core/queue.js";
import { store } from "../core/store.js";
import { createElement } from "../core/utils.js";

export function createContextMenu() {
  const wrapper = createElement("div", "context-menu-wrapper");
  wrapper.id = "context-menu-wrapper";
  wrapper.style.display = "none";

  const hideContextMenu = () => {
    wrapper.classList.add("closing");
    setTimeout(() => {
      wrapper.style.display = "none";
      wrapper.classList.remove("closing");
      wrapper.innerHTML = "";
    }, 200);
  };

  store.on("contextMenu", (ctx) => {
    if (ctx) {
      showContextMenu(wrapper, ctx.track, hideContextMenu);
    } else {
      hideContextMenu();
    }
  });

  return wrapper;
}

function showContextMenu(wrapper, track, hideContextMenu) {
  const isFav = musicLibrary.isFavorite(track.id);
  const playlists = musicLibrary.getPlaylists();

  wrapper.style.display = "block";
  wrapper.innerHTML = `
    <div class="context-menu-overlay"></div>
    <div class="context-menu">
      <div class="context-menu-header">
        <img class="context-menu-art" src="${track.cover}" alt="">
        <div>
          <div class="context-menu-title">${track.title}</div>
          <div class="context-menu-subtitle">${track.artist}</div>
        </div>
      </div>
      <button class="context-menu-item" data-action="like">
        ${isFav ? icons.heartFill : icons.heart}
        <span>${isFav ? "Remove from Liked Songs" : "Like"}</span>
      </button>
      <button class="context-menu-item" data-action="queue">
        ${icons.queue}
        <span>Add to Queue</span>
      </button>
      <button class="context-menu-item" data-action="add-playlist">
        ${icons.addPlaylist}
        <span>Add to Playlist</span>
      </button>
      <button class="context-menu-item" data-action="go-album">
        ${icons.album}
        <span>Go to Album</span>
      </button>
      <button class="context-menu-item" data-action="go-artist">
        ${icons.artist}
        <span>Go to Artist</span>
      </button>
      <div style="height: 1px; background: var(--border); margin: 8px 16px;"></div>
      <button class="context-menu-item" data-action="sleep-timer">
        <svg viewBox="0 0 24 24" fill="currentColor" style="width:22px;height:22px;"><path d="M12 2c5.52 0 10 4.48 10 10s-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2zm0 18c4.41 0 8-3.59 8-8s-3.59-8-8-8-8 3.59-8 8 3.59 8 8 8zm.5-13H11v6l5.2 3.1.8-1.2-4.5-2.7V7z"/></svg>
        <span>Sleep Timer</span>
      </button>
      <button class="context-menu-item" data-action="crossfade">
        <svg viewBox="0 0 24 24" fill="currentColor" style="width:22px;height:22px;"><path d="M17 17h-4v2h4c1.65 0 3-1.35 3-3V8c0-1.65-1.35-3-3-3h-4v2h4c.55 0 1 .45 1 1v8c0 .55-.45 1-1 1zM7 7h4V5H7c-1.65 0-3 1.35-3 3v8c0 1.65 1.35 3 3 3h4v-2H7c-.55 0-1-.45-1-1V8c0-.55.45-1 1-1z"/></svg>
        <span>Crossfade</span>
      </button>
      <button class="context-menu-item" data-action="stop-after">
        <svg viewBox="0 0 24 24" fill="currentColor" style="width:22px;height:22px;"><path d="M6 6h12v12H6z"/></svg>
        <span>Stop after current track</span>
      </button>
      <button class="context-menu-item" data-action="eq">
        <svg viewBox="0 0 24 24" fill="currentColor" style="width:22px;height:22px;"><path d="M10 20h4V4h-4v16zm-6 0h4v-8H4v8zM16 9v11h4V9h-4z"/></svg>
        <span>Equalizer</span>
      </button>
      <button class="context-menu-item" data-action="edit">
        <svg viewBox="0 0 24 24" fill="currentColor" style="width:22px;height:22px;"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
        <span>Edit track info</span>
      </button>
    </div>
  `;

  wrapper
    .querySelector(".context-menu-overlay")
    .addEventListener("click", () => {
      hideContextMenu();
    });

  wrapper
    .querySelector('[data-action="like"]')
    .addEventListener("click", () => {
      const liked = musicLibrary.toggleFavorite(track.id);
      store.showToast(
        liked ? "Added to Liked Songs" : "Removed from Liked Songs",
      );
      store.set("contextMenu", null);
    });

  wrapper
    .querySelector('[data-action="queue"]')
    .addEventListener("click", () => {
      queueManager.addToQueue(track);
      store.showToast("Added to Queue");
      store.set("contextMenu", null);
    });

  wrapper
    .querySelector('[data-action="add-playlist"]')
    .addEventListener("click", () => {
      store.set("contextMenu", null);
      showAddToPlaylistMenu(wrapper, track);
    });

  wrapper
    .querySelector('[data-action="go-album"]')
    .addEventListener("click", () => {
      store.set("contextMenu", null);
      store.set("nowPlayingOpen", false);
      window.location.hash = `#/album/${track.albumId}`;
    });

  wrapper
    .querySelector('[data-action="go-artist"]')
    .addEventListener("click", () => {
      store.set("contextMenu", null);
      store.set("nowPlayingOpen", false);
      window.location.hash = `#/artist/${track.artistId}`;
    });

  wrapper
    .querySelector('[data-action="sleep-timer"]')
    .addEventListener("click", () => {
      showSleepTimerMenu(wrapper);
    });

  wrapper
    .querySelector('[data-action="crossfade"]')
    .addEventListener("click", () => {
      showCrossfadeMenu(wrapper);
    });

  wrapper
    .querySelector('[data-action="stop-after"]')
    .addEventListener("click", () => {
      import("../core/audioEngine.js").then(({ audioEngine }) => {
        const enabled = audioEngine.toggleStopAfterCurrent();
        store.showToast(
          enabled
            ? "Will stop after this track ⏹️"
            : "Playback will continue normally",
        );
        store.set("contextMenu", null);
      });
    });

  wrapper.querySelector('[data-action="eq"]').addEventListener("click", () => {
    store.set("eqOpen", true);
    store.set("contextMenu", null);
  });

  wrapper
    .querySelector('[data-action="edit"]')
    .addEventListener("click", () => {
      const ctx = store.get("contextMenu");
      if (ctx && ctx.track) {
        import("./metadataEditor.js").then(({ createMetadataEditor }) => {
          store.set("modal", {
            title: "Edit Metadata",
            content: createMetadataEditor(ctx.track),
          });
          store.set("contextMenu", null);
        });
      }
    });
}

async function showCrossfadeMenu(wrapper) {
  wrapper.style.display = "block";
  wrapper.innerHTML = `
    <div class="context-menu-overlay"></div>
    <div class="context-menu">
      <div class="context-menu-header">
        <div style="display: flex; align-items: center; gap: 12px; width: 100%;">
          <span style="font-weight: 600; font-size: 16px;">Crossfade Duration</span>
        </div>
      </div>
      <button class="context-menu-item" data-fade="0"><span>Off (Gapless)</span></button>
      <button class="context-menu-item" data-fade="3"><span>3 Seconds</span></button>
      <button class="context-menu-item" data-fade="5"><span>5 Seconds</span></button>
      <button class="context-menu-item" data-fade="10"><span>10 Seconds</span></button>
    </div>
  `;

  wrapper
    .querySelector(".context-menu-overlay")
    .addEventListener("click", () => {
      store.set("contextMenu", null);
    });

  const { audioEngine } = await import("../core/audioEngine.js");

  wrapper.querySelectorAll("[data-fade]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const secs = parseInt(btn.dataset.fade);
      audioEngine.setCrossfade(secs);
      store.showToast(
        secs > 0
          ? `Crossfade set to ${secs}s`
          : "Crossfade turned off (Gapless enabled)",
      );
      store.set("contextMenu", null);
    });
  });
}

async function showSleepTimerMenu(wrapper) {
  wrapper.style.display = "block";
  wrapper.innerHTML = `
    <div class="context-menu-overlay"></div>
    <div class="context-menu">
      <div class="context-menu-header">
        <div style="display: flex; align-items: center; gap: 12px; width: 100%;">
          <span style="font-weight: 600; font-size: 16px;">Sleep Timer</span>
        </div>
      </div>
      <button class="context-menu-item" data-timer="0"><span>Off</span></button>
      <button class="context-menu-item" data-timer="5"><span>5 Minutes</span></button>
      <button class="context-menu-item" data-timer="15"><span>15 Minutes</span></button>
      <button class="context-menu-item" data-timer="30"><span>30 Minutes</span></button>
      <button class="context-menu-item" data-timer="45"><span>45 Minutes</span></button>
      <button class="context-menu-item" data-timer="60"><span>60 Minutes</span></button>
    </div>
  `;

  wrapper
    .querySelector(".context-menu-overlay")
    .addEventListener("click", () => {
      store.set("contextMenu", null);
    });

  const { audioEngine } = await import("../core/audioEngine.js");

  wrapper.querySelectorAll("[data-timer]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mins = parseInt(btn.dataset.timer);
      audioEngine.setSleepTimer(mins);
      if (mins > 0) {
        store.showToast(`Sleep timer set for ${mins} minutes 💤`);
      } else {
        store.showToast("Sleep timer turned off");
      }
      store.set("contextMenu", null);
    });
  });
}

function showAddToPlaylistMenu(wrapper, track) {
  const playlists = musicLibrary.getPlaylists();

  wrapper.style.display = "block";
  wrapper.innerHTML = `
    <div class="context-menu-overlay"></div>
    <div class="context-menu">
      <div class="context-menu-header">
        <div style="display: flex; align-items: center; gap: 12px; width: 100%;">
          <span style="font-weight: 600; font-size: 16px;">Add to Playlist</span>
        </div>
      </div>
      <button class="context-menu-item" data-action="new-playlist">
        ${icons.add}
        <span>New Playlist</span>
      </button>
      ${playlists
        .map(
          (pl) => `
        <button class="context-menu-item" data-action="add-to-${pl.id}">
          ${icons.music}
          <span>${pl.name}</span>
        </button>
      `,
        )
        .join("")}
    </div>
  `;

  wrapper
    .querySelector(".context-menu-overlay")
    .addEventListener("click", () => {
      hideContextMenu();
    });

  wrapper
    .querySelector('[data-action="new-playlist"]')
    .addEventListener("click", () => {
      hideContextMenu();
      store.set("modal", {
        type: "create-playlist",
        data: { trackToAdd: track.id },
      });
    });

  playlists.forEach((pl) => {
    const btn = wrapper.querySelector(`[data-action="add-to-${pl.id}"]`);
    if (btn) {
      btn.addEventListener("click", () => {
        const added = musicLibrary.addTrackToPlaylist(pl.id, track.id);
        store.showToast(added ? `Added to ${pl.name}` : "Already in playlist");
        hideContextMenu();
      });
    }
  });
}
