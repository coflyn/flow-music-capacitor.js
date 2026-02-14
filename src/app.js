import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { icons } from "./core/icons.js";
import { router } from "./router.js";
import { store } from "./core/store.js";
import { musicLibrary } from "./core/library.js";
import { audioEngine } from "./core/audioEngine.js";
import { queueManager } from "./core/queue.js";
import { createElement } from "./core/utils.js";

import { createMiniPlayer } from "./components/miniPlayer.js";
import { createNowPlaying } from "./components/nowPlaying.js";
import { createContextMenu } from "./components/contextMenu.js";
import { createModal } from "./components/modal.js";
import { createToast } from "./components/toast.js";

import { renderHome } from "./pages/home.js";
import { renderDiscovery } from "./pages/discovery.js";
import { renderLibrary } from "./pages/library.js";
import { renderAlbum } from "./pages/album.js";
import { renderArtist } from "./pages/artist.js";
import { renderPlaylist } from "./pages/playlist.js";
import { renderQueue } from "./pages/queue.js";
import { renderSettings } from "./pages/settings.js";

function updateActiveNav(view) {
  let navKey = "home";
  if (view.startsWith("#/discovery")) navKey = "discovery";
  else if (
    view.startsWith("#/library") ||
    view.startsWith("#/album") ||
    view.startsWith("#/artist") ||
    view.startsWith("#/playlist")
  )
    navKey = "library";
  else if (view.startsWith("#/queue")) navKey = "queue";
  else if (view.startsWith("#/settings")) navKey = "settings";

  document.querySelectorAll(".sidebar-nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.nav === navKey);
  });

  document.querySelectorAll(".bottom-nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.nav === navKey);
  });
}

function updateSidebarPlaylists(musicLibrary) {
  const container = document.getElementById("sidebar-playlists");
  if (!container || !musicLibrary) return;

  const playlists = musicLibrary.getPlaylists();
  const favCount = musicLibrary.getFavoriteTracks().length;

  container.innerHTML = "";

  if (favCount > 0) {
    const likedItem = createElement("div", "sidebar-playlist-item");
    likedItem.innerHTML = `
      <div class="sidebar-playlist-thumb" style="background: linear-gradient(135deg, #450af5, #c4efd9); display: flex; align-items: center; justify-content: center;">
        ${icons.heartFill}
      </div>
      <div class="sidebar-playlist-info">
        <div class="sidebar-playlist-name">Liked Songs</div>
        <div class="sidebar-playlist-meta">${favCount} songs</div>
      </div>
    `;
    likedItem.addEventListener("click", () => {
      router.navigate("#/library");
      setTimeout(() => {
        const likedTab = document.querySelector('[data-tab="liked"]');
        if (likedTab) likedTab.click();
      }, 100);
    });
    container.appendChild(likedItem);
  }

  playlists.forEach((pl) => {
    const tracks = musicLibrary.getPlaylistTracks(pl.id);
    const item = createElement("div", "sidebar-playlist-item");
    item.innerHTML = `
      <img class="sidebar-playlist-thumb" src="${pl.cover || (tracks[0] ? tracks[0].cover : "") || ""}" alt="">
      <div class="sidebar-playlist-info">
        <div class="sidebar-playlist-name">${pl.name}</div>
        <div class="sidebar-playlist-meta">Playlist • ${tracks.length} songs</div>
      </div>
    `;
    item.addEventListener("click", () =>
      router.navigate(`#/playlist/${pl.id}`),
    );
    container.appendChild(item);
  });
}

export async function initApp() {
  const appEl = document.getElementById("app");
  if (!appEl) return;
  appEl.innerHTML = "";

  if (!musicLibrary) {
    throw new Error("Critical: Music Library core failed to load.");
  }

  appEl.innerHTML = `
    <div class="app-body">
      <nav class="sidebar" id="sidebar">
        <div class="sidebar-header">
          <div class="sidebar-logo" style="background: var(--text-primary); color: var(--bg-primary);">${icons.sparkles}</div>
          <span class="sidebar-title">Flow</span>
        </div>
        <div class="sidebar-nav" id="sidebar-nav">
          <a class="sidebar-nav-item active" data-route="#/" data-nav="home">
            ${icons.homeFill}
            <span>Home</span>
          </a>
          <a class="sidebar-nav-item" data-route="#/discovery" data-nav="discovery">
            ${icons.sparkles}
            <span>Discovery</span>
          </a>
          <a class="sidebar-nav-item" data-route="#/library" data-nav="library">
            ${icons.library}
            <span>Your Library</span>
          </a>
        </div>
        <div class="sidebar-divider"></div>
        <div class="sidebar-nav">
          <a class="sidebar-nav-item" data-route="#/queue" data-nav="queue">
            ${icons.queue}
            <span>Queue</span>
          </a>
          <a class="sidebar-nav-item" data-route="#/settings" data-nav="settings">
            ${icons.settings}
            <span>Settings</span>
          </a>
        </div>
        <div class="sidebar-divider"></div>
        <div class="sidebar-playlists" id="sidebar-playlists"></div>
      </nav>
      <main class="main-content" id="main-content"></main>
    </div>
  `;

  if (Capacitor.isNativePlatform()) {
    StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
    StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
    StatusBar.setBackgroundColor({ color: "#000000" }).catch(() => {});

    if (Capacitor.getPlatform() === "android") {
      try {
        const NowPlaying = (await import("@capacitor/core")).registerPlugin(
          "NowPlaying",
        );
        NowPlaying.requestPermissions().catch(() => {});
      } catch (e) {
        // Plugin not available, ignore
      }
    }
  }

  appEl.appendChild(createMiniPlayer());

  const bottomNav = createElement("nav", "bottom-nav");
  bottomNav.innerHTML = `
    <div class="bottom-nav-items">
      <button class="bottom-nav-item active" data-route="#/" data-nav="home">
        ${icons.homeFill}
        <span>Home</span>
      </button>
      <button class="bottom-nav-item" data-route="#/discovery" data-nav="discovery">
        ${icons.sparkles}
        <span>Discovery</span>
      </button>
      <button class="bottom-nav-item" data-route="#/library" data-nav="library">
        ${icons.library}
        <span>Library</span>
      </button>
      <button class="bottom-nav-item" data-route="#/settings" data-nav="settings">
        ${icons.settings}
        <span>Settings</span>
      </button>
    </div>
  `;
  appEl.appendChild(bottomNav);

  appEl.appendChild(createNowPlaying());
  appEl.appendChild(createContextMenu());
  appEl.appendChild(createModal());
  appEl.appendChild(createToast());

  import("./components/equalizer.js").then(({ createEqualizer }) => {
    const eqPanel = createEqualizer();
    appEl.appendChild(eqPanel);

    store.on("eqOpen", (open) => {
      eqPanel.classList.toggle("open", open);
      if (open && audioEngine.audioCtx) {
        audioEngine.audioCtx.resume().catch(() => {});
      }
    });
  });

  const mainContent = appEl.querySelector("#main-content");

  appEl.querySelectorAll("[data-route]").forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      router.navigate(item.dataset.route);
    });
  });

  store.on("currentView", (view) => {
    updateActiveNav(view);
    updateSidebarPlaylists(musicLibrary);
  });

  audioEngine.on("trackchange", ({ track }) => {
    musicLibrary.addToRecent(track.id);
    musicLibrary.incrementPlayCount(track.id);
  });

  router.register("#/", () => renderHome(mainContent));
  router.register("#/discovery", () => renderDiscovery(mainContent));
  router.register("#/library", () => renderLibrary(mainContent));
  router.register("#/album/:id", (params) => renderAlbum(mainContent, params));
  router.register("#/artist/:id", (params) =>
    renderArtist(mainContent, params),
  );
  router.register("#/playlist/:id", (params) =>
    renderPlaylist(mainContent, params),
  );
  router.register("#/queue", () => renderQueue(mainContent));
  router.register("#/settings", () => renderSettings(mainContent));

  updateSidebarPlaylists(musicLibrary);
  try {
    router.init();
  } catch (err) {
    console.error("Router init failed", err);
  }

  musicLibrary
    .init()
    .then(() => {
      router._resolve();
      updateSidebarPlaylists(musicLibrary);

      setTimeout(() => {
        store.showToast(`Welcome back to Flow 🛡️✨`);
      }, 1000);
    })
    .catch((err) => {
      console.warn("Library init failed", err);
    });

  musicLibrary.on("updated", (data) => {
    if (data && data.tracks > 0) {
      store.showToast(`Found ${data.tracks} songs!`);
    } else if (data && data.tracks === 0) {
      store.showToast("No music found on device.");
    }
  });
}
