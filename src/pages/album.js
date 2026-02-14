import { icons } from "../core/icons.js";
import { musicLibrary } from "../core/library.js";
import { queueManager } from "../core/queue.js";
import { router } from "../router.js";
import { createElement, formatTime } from "../core/utils.js";
import { renderTrackList } from "../components/trackList.js";

export function renderAlbum(container, params) {
  container.innerHTML = "";
  const album = musicLibrary.getAlbumById(params.id);
  if (!album) {
    container.innerHTML =
      '<div class="page"><div class="empty-state"><div class="empty-state-title">Album not found</div></div></div>';
    return;
  }

  const tracks = musicLibrary.getTracksByAlbum(album.id);
  const totalDuration = tracks.reduce((sum, t) => sum + t.duration, 0);
  const page = createElement("div", "page");

  page.innerHTML = `
    <div class="page-header">
      <div class="page-header-bg"></div>
      <img class="page-header-art" src="${album.cover}" alt="${album.title}">
      <div class="page-header-info">
        <div class="page-header-type">Album</div>
        <h1 class="page-header-title">${album.title}</h1>
        <div class="page-header-meta">
          <span style="cursor: pointer;" data-artist-link="${album.artistId}">${album.artist}</span>
          <span class="page-header-dot"></span>
          <span>${album.year}</span>
          <span class="page-header-dot"></span>
          <span>${tracks.length} songs, ${formatTime(totalDuration)}</span>
        </div>
      </div>
    </div>

    <div class="action-bar">
      <button class="action-btn-play" id="play-album">${icons.play}</button>
      <button class="action-btn" id="shuffle-album">Shuffle</button>
    </div>

    <div id="album-tracks"></div>
  `;

  container.appendChild(page);

  const artistLink = page.querySelector("[data-artist-link]");
  if (artistLink) {
    artistLink.addEventListener("click", () => {
      router.navigate(`#/artist/${album.artistId}`);
    });
  }

  page.querySelector("#play-album").addEventListener("click", () => {
    queueManager.playAll(tracks, 0);
    musicLibrary.addToRecent(tracks[0].id);
  });

  page.querySelector("#shuffle-album").addEventListener("click", () => {
    queueManager.playAll(tracks, 0);
    queueManager.toggleShuffle();
  });

  renderTrackList(tracks, page.querySelector("#album-tracks"));
}
