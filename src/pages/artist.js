import { icons } from "../core/icons.js";
import { musicLibrary } from "../core/library.js";
import { queueManager } from "../core/queue.js";
import { audioEngine } from "../core/audioEngine.js";
import { router } from "../router.js";
import { createElement } from "../core/utils.js";
import { renderTrackList } from "../components/trackList.js";

export function renderArtist(container, params) {
  container.innerHTML = "";
  const artist = musicLibrary.getArtistById(params.id);
  if (!artist) {
    container.innerHTML =
      '<div class="page"><div class="empty-state"><div class="empty-state-title">Artist not found</div></div></div>';
    return;
  }

  const tracks = musicLibrary.getTracksByArtist(artist.id);
  const albums = musicLibrary.getAlbumsByArtist(artist.id);
  const artistCover = musicLibrary.getArtistCover(artist.id);
  const page = createElement("div", "page artist-page");

  page.innerHTML = `
    <div class="page-header" style="flex-direction: column; align-items: center; text-align: center;">
      <div class="page-header-bg"></div>
      ${
        artistCover
          ? `<img class="page-header-art" src="${artistCover}" alt="${artist.name}" style="border-radius: 50%;">`
          : `<div class="page-header-art" style="border-radius: 50%; display:flex;align-items:center;justify-content:center;background:var(--bg-highlight);color:var(--text-tertiary)">${icons.artist}</div>`
      }
      <div class="page-header-info" style="text-align: center;">
        <div class="page-header-type">Artist</div>
        <h1 class="page-header-title">${artist.name}</h1>
        <div class="page-header-meta" style="justify-content: center;">
          <span>${tracks.length} songs</span>
          ${albums.length > 0 ? `<span class="page-header-dot"></span><span>${albums.length} albums</span>` : ""}
        </div>
      </div>
    </div>

    <div class="action-bar">
      <button class="action-btn-play" id="play-artist">${icons.play}</button>
      <button class="action-btn" id="shuffle-artist">${icons.shuffle}</button>
    </div>

    <div id="artist-popular"></div>
    <div id="artist-albums" style="margin-top: var(--sp-8);"></div>
  `;

  container.appendChild(page);

  page.querySelector("#play-artist").addEventListener("click", () => {
    queueManager.playAll(tracks, 0);
    musicLibrary.addToRecent(tracks[0].id);
  });

  page.querySelector("#shuffle-artist").addEventListener("click", () => {
    if (!audioEngine.shuffleMode) {
      queueManager.toggleShuffle();
    }
    const randomIndex = Math.floor(Math.random() * tracks.length);
    queueManager.playAll(tracks, randomIndex);
  });

  const popularSection = page.querySelector("#artist-popular");
  popularSection.innerHTML =
    '<h3 class="section-title" style="margin-bottom: var(--sp-4);">Popular</h3>';
  const trackContainer = createElement("div", "");
  renderTrackList(tracks, trackContainer);
  popularSection.appendChild(trackContainer);

  if (albums.length > 0) {
    const albumSection = page.querySelector("#artist-albums");
    albumSection.innerHTML =
      '<h3 class="section-title" style="margin-bottom: var(--sp-4);">Albums</h3>';
    const grid = createElement("div", "cards-grid");
    albums.forEach((album) => {
      const card = createElement("div", "card");
      card.innerHTML = `
        <div style="position: relative;">
          <img class="card-art" src="${album.cover}" alt="${album.title}" loading="lazy">
          <button class="card-play-btn">${icons.play}</button>
        </div>
        <div class="card-title">${album.title}</div>
        <div class="card-subtitle">${album.year}</div>
      `;
      card.querySelector(".card-play-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        const albumTracks = musicLibrary.getTracksByAlbum(album.id);
        queueManager.playAll(albumTracks, 0);
      });
      card.addEventListener("click", () =>
        router.navigate(`#/album/${album.id}`),
      );
      grid.appendChild(card);
    });
    albumSection.appendChild(grid);
  }
}
