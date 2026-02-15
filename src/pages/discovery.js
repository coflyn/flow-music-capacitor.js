import { icons } from "../core/icons.js";
import { musicLibrary } from "../core/library.js";
import { queueManager } from "../core/queue.js";
import { router } from "../router.js";
import {
  createElement,
  cleanTitle,
  getDominantColor,
  rgbToHex,
} from "../core/utils.js";
import { renderTrackList } from "../components/trackList.js";

export function renderDiscovery(container) {
  container.innerHTML = "";
  const page = createElement("div", "page");

  const recentTrack = musicLibrary.getRecentlyAdded(1)[0];
  const forgottenTracks = musicLibrary.getForgottenTracks(10);
  const randomAlbum = musicLibrary.getRandomAlbum();
  const highlightedAlbums = musicLibrary.getRandomAlbums(8);

  page.innerHTML = `
    <header style="margin-bottom: var(--sp-8);">
      <h1 class="page-title" style="margin-bottom: var(--sp-2);">Smart Discovery</h1>
      <p style="color: var(--text-secondary); font-size: var(--fs-md);">Your daily mixes, personalized for you.</p>
    </header>

    <div class="discovery-sections">
      
      <!-- Feature Card: Lucky Dip -->
      ${renderLuckyDip(randomAlbum)}
      ${!randomAlbum ? renderPlaceholder("Lucky Dip", icons.shuffle, "Shuffle your collection once you have albums.") : ""}

      <!-- Horizon Mix: Forgotten Gems -->
      <section style="margin-top: var(--sp-10);">
        <h2 class="section-title" style="margin-bottom: var(--sp-4); display: flex; align-items: center; gap: var(--sp-2);">
          Forgotten Gems
        </h2>
        
        ${
          forgottenTracks.length > 0
            ? `
        <div class="horizontal-scroll" style="display: flex; gap: var(--sp-4); overflow-x: auto; padding-bottom: var(--sp-4); scrollbar-width: none;">
          ${forgottenTracks
            .map(
              (t) => `
            <div class="mix-card" data-track-id="${t.id}" style="flex: 0 0 160px; cursor: pointer;">
              <img src="${t.cover}" style="width: 160px; height: 160px; border-radius: var(--radius-lg); object-fit: cover; box-shadow: var(--shadow-lg);">
              <div style="margin-top: var(--sp-3);">
                <div class="track-title" style="font-size: var(--fs-md); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${cleanTitle(t.title, 25)}</div>
                <div class="track-artist" style="font-size: var(--fs-xs); color: var(--text-tertiary);">${t.artist}</div>
              </div>
            </div>
          `,
            )
            .join("")}
        </div>`
            : renderPlaceholder(
                "Forgotten Gems",
                icons.history,
                "Listen to more music to populate this list.",
              )
        }

      </section>

      <!-- Grid: Album Highlights -->
      <section style="margin-top: var(--sp-10);">
        <h2 class="section-title" style="margin-bottom: var(--sp-4);">Album Highlights</h2>
        
        ${
          highlightedAlbums.length > 0
            ? `
        <div class="cards-grid">
          ${highlightedAlbums
            .map(
              (album) => `
            <div class="card album-card" data-album-id="${album.id}">
              <img class="card-art" src="${album.cover}" alt="">
              <div class="card-title" style="font-size: var(--fs-base);">${cleanTitle(album.title, 30)}</div>
              <div class="card-subtitle">${album.artist}</div>
            </div>
          `,
            )
            .join("")}
        </div>`
            : renderPlaceholder(
                "Highlights",
                icons.album,
                "Scan your library to see albums here.",
              )
        }

      </section>
    </div>
  `;

  function renderPlaceholder(title, icon, message) {
    return `
      <div class="glass-card" style="padding: 20px; border-radius: 16px; display: flex; align-items: center; gap: 15px; opacity: 0.6; border: 1px dashed var(--border); margin-bottom: 10px;">
         <div style="width: 40px; height: 40px; background: var(--bg-elevated); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--text-secondary);">
            ${icon}
         </div>
         <div style="flex: 1;">
            <div style="font-size: 14px; font-weight: 600;">${title} Unavailable</div>
            <div style="font-size: 11px; color: var(--text-tertiary);">${message}</div>
         </div>
      </div>
    `;
  }

  container.appendChild(page);

  page.querySelectorAll(".mix-card").forEach((card) => {
    card.addEventListener("click", () => {
      const idx = forgottenTracks.findIndex(
        (t) => t.id === card.dataset.trackId,
      );
      if (idx >= 0) queueManager.playAll(forgottenTracks, idx);
    });
  });

  page.querySelectorAll(".album-card").forEach((card) => {
    card.addEventListener("click", () => {
      router.navigate(`#/album/${card.dataset.albumId}`);
    });
  });

  const luckyDipBtn = page.querySelector("#lucky-dip-play");
  if (luckyDipBtn && randomAlbum) {
    luckyDipBtn.addEventListener("click", () => {
      router.navigate(`#/album/${randomAlbum.id}`);
    });

    if (randomAlbum.cover) {
      getDominantColor(randomAlbum.cover).then((color) => {
        const hex = rgbToHex(color.r, color.g, color.b);
        const card = page.querySelector(".lucky-dip-card");
        if (card) {
          card.style.setProperty("--dip-accent", hex);
          card.style.setProperty(
            "--dip-accent-rgb",
            `${color.r}, ${color.g}, ${color.b}`,
          );
        }
      });
    }
  }
}

function renderLuckyDip(album) {
  if (!album) return "";
  return `
    <div class="lucky-dip-card">
      <div class="lucky-dip-bg" style="background-image: url('${album.cover}')"></div>
      <div class="lucky-dip-overlay"></div>
      
      <div class="lucky-dip-content">
        <div class="lucky-dip-info">
          <div class="lucky-dip-badge">
            <span>Lucky Dip</span>
          </div>
          <h2 class="lucky-dip-title">${album.title}</h2>
          <p class="lucky-dip-artist">${album.artist}</p>
        </div>
        
        <div class="lucky-dip-visual">
          <img src="${album.cover}" class="lucky-dip-cover">
          <button class="lucky-dip-fab" id="lucky-dip-play" aria-label="Open Album">
            ${icons.play}
          </button>
        </div>
      </div>

      <style>
        .lucky-dip-card {
          position: relative;
          width: 100%;
          min-height: 200px;
          border-radius: var(--radius-3xl);
          overflow: hidden;
          background: #000;
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
          display: flex;
          align-items: center;
        }

        .lucky-dip-bg {
          position: absolute;
          top: -20px;
          left: -20px;
          right: -20px;
          bottom: -20px;
          background-size: cover;
          background-position: center;
          filter: blur(30px) brightness(0.5);
          opacity: 0.6;
          z-index: 0;
        }

        .lucky-dip-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(105deg, rgba(0,0,0,0.8) 30%, rgba(0,0,0,0) 100%);
          z-index: 1;
        }

        .lucky-dip-content {
          position: relative;
          z-index: 2;
          width: 100%;
          padding: var(--sp-8);
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: var(--sp-6);
        }

        .lucky-dip-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(var(--dip-accent-rgb, var(--accent-rgb)), 0.2);
          color: var(--dip-accent, var(--accent));
          padding: 6px 14px;
          border-radius: 50px;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-bottom: var(--sp-4);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(var(--dip-accent-rgb, var(--accent-rgb)), 0.3);
        }

        .lucky-dip-title {
          font-size: clamp(1.5rem, 5vw, 2.2rem);
          font-weight: 900;
          line-height: 1.1;
          margin-bottom: var(--sp-2);
          letter-spacing: -0.02em;
          color: #fff;
        }

        .lucky-dip-artist {
          font-size: var(--fs-md);
          color: rgba(255, 255, 255, 0.7);
          font-weight: 500;
        }

        .lucky-dip-visual {
          position: relative;
          flex-shrink: 0;
        }

        .lucky-dip-cover {
          width: 160px;
          height: 160px;
          border-radius: var(--radius-2xl);
          object-fit: cover;
          box-shadow: 0 15px 45px rgba(0, 0, 0, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .lucky-dip-fab {
          position: absolute;
          bottom: -15px;
          right: -15px;
          width: 60px;
          height: 60px;
          background: var(--dip-accent, var(--accent));
          color: #000;
          border: none;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 25px rgba(var(--dip-accent-rgb, var(--accent-rgb)), 0.5);
          cursor: pointer;
          transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        .lucky-dip-fab:active {
          transform: scale(0.9);
        }

        .lucky-dip-fab svg {
          width: 28px;
          height: 28px;
        }

        @media (max-width: 480px) {
          .lucky-dip-content {
            flex-direction: column-reverse;
            text-align: center;
          }
          .lucky-dip-info {
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .lucky-dip-overlay {
            background: rgba(0,0,0,0.6);
          }
        }
      </style>
    </div>
  `;
}
