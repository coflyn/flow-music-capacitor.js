import { icons } from "../core/icons.js";
import { musicLibrary } from "../core/library.js";
import { queueManager } from "../core/queue.js";
import { router } from "../router.js";
import { store } from "../core/store.js";
import { createElement, cleanTitle } from "../core/utils.js";
import { renderTrackList } from "../components/trackList.js";

export function renderLibrary(container) {
  container.innerHTML = "";
  const page = createElement("div", "page");

  page.innerHTML = `
    <header style="margin-bottom: var(--sp-8);">
      <div style="display:flex; align-items:flex-start; justify-content:space-between;">
        <div>
          <h1 class="page-title" style="margin-bottom: var(--sp-1);">Your Library</h1>
          <p style="color: var(--text-secondary); font-size: var(--fs-sm);">Manage your local collection.</p>
        </div>
        <button class="icon-btn" id="refresh-library-btn" title="Add Music Folder" style="width:40px; height:40px; border-radius:50%; background:var(--bg-surface); display:flex; align-items:center; justify-content:center;">
          ${icons.folder}
        </button>
      </div>
    </header>
    <div class="tabs" id="library-tabs">
      <button class="tab active" data-tab="songs">Songs</button>
      <button class="tab" data-tab="albums">Albums</button>
      <button class="tab" data-tab="artists">Artists</button>
      <button class="tab" data-tab="playlists">Playlists</button>
      <button class="tab" data-tab="liked">Liked</button>
    </div>
    <div id="library-controls" style="margin-bottom: var(--sp-4); display: none;">
      <div style="display:flex; gap: var(--sp-2); align-items: center;">
        <div class="search-wrapper" style="flex: 1; margin: 0;">
          <div class="search-icon">${icons.search}</div>
          <input type="text" class="search-input" id="lib-filter-input" placeholder="Search in songs..." style="height: 38px;">
        </div>
        <button class="icon-btn" id="lib-sort-btn" style="background: var(--bg-surface); border-radius: var(--radius-md); width: 38px; height: 38px;">
          <svg viewBox="0 0 24 24" fill="currentColor" style="width: 20px; height: 20px;"><path d="M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z"/></svg>
        </button>
      </div>
    </div>
    <div id="library-content"></div>
  `;

  let currentFilter = "";
  let currentSort = "title";

  const refreshBtn = page.querySelector("#refresh-library-btn");
  refreshBtn.addEventListener("click", async () => {
    refreshBtn.classList.add("spinning");
    await musicLibrary.pickAndScanFolder();
    refreshBtn.classList.remove("spinning");
    const activeTab = page.querySelector(".tab.active");
    if (activeTab)
      renderTab(contentEl, activeTab.dataset.tab, {
        currentFilter,
        currentSort,
      });
  });

  container.appendChild(page);

  const tabsEl = page.querySelector("#library-tabs");
  const contentEl = page.querySelector("#library-content");
  const controlsEl = page.querySelector("#library-controls");
  const filterInput = page.querySelector("#lib-filter-input");
  const sortBtn = page.querySelector("#lib-sort-btn");

  tabsEl.addEventListener("click", (e) => {
    const tab = e.target.closest(".tab");
    if (!tab) return;

    tabsEl
      .querySelectorAll(".tab")
      .forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");

    const tabName = tab.dataset.tab;
    controlsEl.style.display =
      tabName === "songs" || tabName === "liked" ? "block" : "none";

    renderTab(contentEl, tabName, { currentFilter, currentSort });
  });

  filterInput.addEventListener("input", (e) => {
    currentFilter = e.target.value;
    const activeTab = page.querySelector(".tab.active");
    renderTab(contentEl, activeTab.dataset.tab, { currentFilter, currentSort });
  });

  sortBtn.addEventListener("click", () => {
    const options = [
      { id: "title", label: "Title" },
      { id: "artist", label: "Artist" },
      { id: "album", label: "Album" },
      { id: "date", label: "Recently Added" },
      { id: "duration", label: "Duration" },
    ];

    const menu = createElement("div", "");
    menu.innerHTML = `
      <div class="context-menu-overlay"></div>
      <div class="context-menu">
        <div class="context-menu-header"><span style="font-weight:600;">Sort by</span></div>
        ${options
          .map(
            (opt) => `
          <button class="context-menu-item" data-sort="${opt.id}">
            <span style="${currentSort === opt.id ? "color:var(--accent);font-weight:600;" : ""}">${opt.label}</span>
          </button>
        `,
          )
          .join("")}
      </div>
    `;
    document.body.appendChild(menu);

    menu
      .querySelector(".context-menu-overlay")
      .addEventListener("click", () => menu.remove());
    menu.querySelectorAll("[data-sort]").forEach((btn) => {
      btn.addEventListener("click", () => {
        currentSort = btn.dataset.sort;
        const activeTab = page.querySelector(".tab.active");
        renderTab(contentEl, activeTab.dataset.tab, {
          currentFilter,
          currentSort,
        });
        menu.remove();
      });
    });
  });

  controlsEl.style.display = "block";
  renderTab(contentEl, "songs", { currentFilter, currentSort });

  const onUpdate = () => {
    if (document.getElementById("library-tabs")) {
      const activeTab = page.querySelector(".tab.active");
      if (activeTab) {
        renderTab(contentEl, activeTab.dataset.tab, {
          currentFilter,
          currentSort,
        });
      }
    } else {
      musicLibrary.off("updated", onUpdate);
    }
  };
  musicLibrary.on("updated", onUpdate);
}

function renderTab(container, tabName, options = {}) {
  container.innerHTML = "";

  switch (tabName) {
    case "songs":
      renderSongsTab(container, options);
      break;
    case "albums":
      renderAlbumsTab(container);
      break;
    case "artists":
      renderArtistsTab(container);
      break;
    case "playlists":
      renderPlaylistsTab(container);
      break;
    case "liked":
      renderLikedTab(container, options);
      break;
  }
}

function renderSongsTab(
  container,
  { currentFilter = "", currentSort = "title" } = {},
) {
  let tracks = musicLibrary.getAllTracks();

  if (currentFilter) {
    const q = currentFilter.toLowerCase();
    tracks = tracks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        t.album.toLowerCase().includes(q),
    );
  }

  tracks = musicLibrary.sortTracks(tracks, currentSort, currentSort !== "date"); // Date usually desc

  if (tracks.length === 0) {
    showEmpty(
      container,
      currentFilter ? "No matches found" : "No songs yet",
      currentFilter ? "Try a different search" : "Your library is empty",
    );
    return;
  }

  const trackContainer = createElement("div", "");
  renderTrackList(tracks, trackContainer);
  container.appendChild(trackContainer);
}

function renderAlbumsTab(container) {
  const albums = musicLibrary.getAllAlbums();
  if (albums.length === 0) {
    showEmpty(container, "No albums", "Albums you save will appear here");
    return;
  }

  const grid = createElement("div", "cards-grid");
  albums.forEach((album) => {
    const card = createElement("div", "card");
    card.innerHTML = `
      <div style="position: relative;">
        <img class="card-art" src="${album.cover || ""}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
        <div class="card-art card-art-fallback" style="display:none;align-items:center;justify-content:center;color:var(--text-tertiary)">${icons.album}</div>
        <button class="card-play-btn">${icons.play}</button>
      </div>
      <div class="card-title">${cleanTitle(album.title, 30)}</div>
      <div class="card-subtitle">${album.artist}${album.year ? " • " + album.year : ""}</div>
    `;

    card.querySelector(".card-play-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      const tracks = musicLibrary.getTracksByAlbum(album.id);
      queueManager.playAll(tracks, 0);
    });

    card.addEventListener("click", () => {
      router.navigate(`#/album/${album.id}`);
    });

    grid.appendChild(card);
  });

  container.appendChild(grid);
}

function renderArtistsTab(container) {
  const artists = musicLibrary.getAllArtists();
  if (artists.length === 0) {
    showEmpty(container, "No artists", "Artists you follow will appear here");
    return;
  }

  const grid = createElement("div", "cards-grid");
  artists.forEach((artist) => {
    const artistCover = musicLibrary.getArtistCover(artist.id);
    const card = createElement("div", "card");
    card.innerHTML = `
      <div style="position: relative;">
        ${
          artistCover
            ? `<img class="card-art rounded" src="${artistCover}" alt="${artist.name}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
            : ""
        }
        <div class="card-art rounded" style="${artistCover ? "display:none;" : ""}align-items:center;justify-content:center;background:var(--bg-highlight);color:var(--text-tertiary)">${icons.artist}</div>
        <button class="card-play-btn">${icons.play}</button>
      </div>
      <div class="card-title">${artist.name}</div>
      <div class="card-subtitle">${artist.numTracks || 0} tracks</div>
    `;

    card.querySelector(".card-play-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      const tracks = musicLibrary.getTracksByArtist(artist.id);
      queueManager.playAll(tracks, 0);
    });

    card.addEventListener("click", () => {
      router.navigate(`#/artist/${artist.id}`);
    });

    grid.appendChild(card);
  });

  container.appendChild(grid);
}

function renderPlaylistsTab(container) {
  const playlists = musicLibrary.getPlaylists();

  if (playlists.length === 0) {
    showEmpty(container, "No playlists yet", "Create your first playlist");
  }

  const createBtn = createElement("button", "featured-card");
  createBtn.style.marginBottom = "var(--sp-4)";
  createBtn.style.border = "1px dashed var(--border-light)";
  createBtn.style.background = "transparent";

  if (playlists.length === 0) {
    createBtn.style.margin = "var(--sp-8) auto";
    createBtn.style.display = "flex";
    createBtn.style.width = "max-content";
    createBtn.style.padding = "var(--sp-4) var(--sp-10)";
    createBtn.style.justifyContent = "center";
    createBtn.style.border = "1px solid var(--border-light)";
  }

  createBtn.innerHTML = `
    <div style="width: 64px; height: 64px; display: flex; align-items: center; justify-content: center; color: var(--text-secondary);">
      ${icons.add}
    </div>
    <span class="featured-card-title" style="color: var(--text-secondary);">Create Playlist</span>
  `;
  createBtn.addEventListener("click", () => {
    store.set("modal", { type: "create-playlist", data: {} });
  });
  container.appendChild(createBtn);

  if (playlists.length === 0) return;

  playlists.forEach((playlist) => {
    const tracks = musicLibrary.getPlaylistTracks(playlist.id);
    const coverUrl = playlist.cover || tracks[0]?.cover;
    const card = createElement("div", "featured-card");
    card.style.marginBottom = "var(--sp-2)";
    card.innerHTML = `
      <div class="featured-card-art-container" style="position: relative; width: 64px; height: 64px; border-radius: var(--radius-md); overflow: hidden; background: var(--bg-card); flex-shrink: 0;">
        ${
          coverUrl
            ? `<img class="featured-card-art" src="${coverUrl}" alt="${playlist.name}" style="width: 100%; height: 100%; object-fit: cover;">`
            : `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: var(--text-tertiary); background: var(--bg-highlight);">${icons.music}</div>`
        }
      </div>
      <span class="featured-card-title">${playlist.name} <span style="color: var(--text-tertiary); font-weight: 400; font-size: 12px;">${tracks.length} songs</span></span>
    `;
    card.addEventListener("click", () => {
      router.navigate(`#/playlist/${playlist.id}`);
    });
    container.appendChild(card);
  });
}

function renderLikedTab(
  container,
  { currentFilter = "", currentSort = "title" } = {},
) {
  let favorites = musicLibrary.getFavoriteTracks();

  if (currentFilter) {
    const q = currentFilter.toLowerCase();
    favorites = favorites.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        t.album.toLowerCase().includes(q),
    );
  }

  favorites = musicLibrary.sortTracks(
    favorites,
    currentSort,
    currentSort !== "date",
  );

  if (favorites.length === 0) {
    showEmpty(
      container,
      currentFilter ? "No matches found" : "No liked songs",
      currentFilter
        ? "Try a different search"
        : "Songs you like will appear here",
    );
    return;
  }

  const trackContainer = createElement("div", "");
  renderTrackList(favorites, trackContainer);
  container.appendChild(trackContainer);
}

function showEmpty(container, title, text) {
  const empty = createElement("div", "empty-state");
  empty.innerHTML = `
    <div class="empty-state-icon">${icons.music}</div>
    <div class="empty-state-title">${title}</div>
    <div class="empty-state-text">${text}</div>
  `;
  container.appendChild(empty);
}
