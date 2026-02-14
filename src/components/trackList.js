import { icons } from "../core/icons.js";
import { audioEngine } from "../core/audioEngine.js";
import { queueManager } from "../core/queue.js";
import { musicLibrary } from "../core/library.js";
import { store } from "../core/store.js";
import { haptics } from "../core/haptics.js";
import { formatTime, createElement, cleanTitle } from "../core/utils.js";

export function renderTrackList(tracks, container, options = {}) {
  const {
    showAlbumArt = true,
    showNumbers = true,
    context = "musicLibrary",
  } = options;
  container.innerHTML = "";

  const list = createElement("div", "track-list");

  tracks.forEach((track, index) => {
    const isPlaying =
      queueManager.getCurrentTrack()?.id === track.id && audioEngine.isPlaying;
    const isCurrent = queueManager.getCurrentTrack()?.id === track.id;
    const isFav = musicLibrary.isFavorite(track.id);

    const item = createElement(
      "div",
      `track-item${isCurrent ? " playing" : ""}`,
    );
    item.dataset.trackId = track.id;
    item.id = `track-${track.id}`;

    item.innerHTML = `
      ${
        showNumbers
          ? `
        <div class="track-number-col">
          ${
            isCurrent && audioEngine.isPlaying
              ? `
            <div class="eq-bars">
              <div class="eq-bar"></div>
              <div class="eq-bar"></div>
              <div class="eq-bar"></div>
              <div class="eq-bar"></div>
            </div>
          `
              : `
            <span class="track-number">${index + 1}</span>
            <span class="track-play-icon">${icons.play}</span>
          `
          }
        </div>
      `
          : ""
      }
      ${showAlbumArt ? `<img class="track-art" src="${track.cover || ""}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="track-art track-art-fallback" style="display:none;align-items:center;justify-content:center;color:var(--text-tertiary)">${icons.music}</div>` : ""}
      <div class="track-info">
        <div class="track-title">${cleanTitle(track.title, 40)}</div>
        <div class="track-artist">${track.artist}</div>
      </div>
      <div class="track-meta">
        <button class="track-like${isFav ? " liked" : ""}" data-action="like" data-track-id="${track.id}">
          ${isFav ? icons.heartFill : icons.heart}
        </button>
        <span class="track-duration">${formatTime(track.duration)}</span>
        <button class="track-more" data-action="more" data-track-id="${track.id}" style="padding: 4px; color: var(--text-tertiary);">
          ${icons.moreVert}
        </button>
      </div>
    `;

    item.addEventListener("click", (e) => {
      if (e.target.closest("[data-action]")) return;
      haptics.light();
      queueManager.playAll(tracks, index);
      musicLibrary.addToRecent(track.id);
    });

    const likeBtn = item.querySelector('[data-action="like"]');
    likeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      haptics.light();
      const liked = musicLibrary.toggleFavorite(track.id);
      likeBtn.className = `track-like${liked ? " liked" : ""}`;
      likeBtn.innerHTML = liked ? icons.heartFill : icons.heart;
      store.showToast(
        liked ? "Added to Liked Songs" : "Removed from Liked Songs",
      );
    });

    const moreBtn = item.querySelector('[data-action="more"]');
    moreBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      haptics.light();
      store.set("contextMenu", { track });
    });

    list.appendChild(item);
  });

  container.appendChild(list);
}
