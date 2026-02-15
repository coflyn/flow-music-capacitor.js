import { icons } from "../core/icons.js";
import { musicLibrary } from "../core/library.js";
import { queueManager } from "../core/queue.js";
import { store } from "../core/store.js";
import { createElement, cleanTitle } from "../core/utils.js";
import { haptics } from "../core/haptics.js";
import { router } from "../router.js";

export function renderHome(container) {
  container.innerHTML = "";
  const page = createElement("div", "page animate-in");

  const onUpdate = () => {
    if (document.body.contains(page)) {
      renderHomeContent(page);
    } else {
      musicLibrary.off("updated", onUpdate);
    }
  };

  musicLibrary.on("updated", onUpdate);
  container.appendChild(page);
  renderHomeContent(page);
}

function renderHomeContent(page) {
  const allTracks = musicLibrary.getAllTracks();
  const recentTracks = musicLibrary.getRecentlyPlayed();
  const mostPlayed = musicLibrary.getMostPlayed(6);
  const recentlyAdded = musicLibrary.getRecentlyAdded(8);

  const hour = new Date().getHours();
  let greeting = "Good morning";
  if (hour >= 12 && hour < 17) greeting = "Good afternoon";
  else if (hour >= 17 || hour < 4) greeting = "Good evening";
  else if (hour >= 4 && hour < 12) greeting = "Good morning";

  page.innerHTML = "";

  const header = createElement("header", "home-header");
  header.style.marginBottom = "var(--sp-10)";
  header.innerHTML = `
    <div style="margin-bottom: var(--sp-6);">
      <h1 class="page-title">${greeting}</h1>
      <p style="color: var(--text-secondary); margin-top: 4px;">Start your flow session.</p>
    </div>
  `;

  if (allTracks.length > 0) {
    const highlight = recentTracks[0] || allTracks[0];
    const heroCard = createElement("div", "glass-card");
    heroCard.style.padding = "var(--sp-6)";
    heroCard.style.borderRadius = "var(--radius-2xl)";
    heroCard.style.display = "flex";
    heroCard.style.alignContent = "center";
    heroCard.style.gap = "var(--sp-6)";
    heroCard.style.cursor = "pointer";
    heroCard.style.transition = "transform 0.2s ease";
    heroCard.style.background = "rgba(255, 255, 255, 0.03)";
    heroCard.style.backdropFilter = "blur(10px)";
    heroCard.style.webkitBackdropFilter = "blur(10px)";
    heroCard.style.border = "1px solid rgba(255, 255, 255, 0.08)";

    heroCard.innerHTML = `
      <div style="width: 100px; height: 100px; display: flex; align-items: center; justify-content: center; background: var(--bg-card); border-radius: var(--radius-lg); overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,0.5);">
        <img src="${highlight.cover}" style="width: 100%; height: 100%; object-fit: contain;">
      </div>
      <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; min-width: 0;">
        <span style="color: var(--accent); font-weight: 700; font-size: var(--fs-2xs); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px;">Jump back in</span>
        <h2 style="font-size: var(--fs-xl); margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${cleanTitle(highlight.title, 30)}</h2>
        <p style="color: var(--text-tertiary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${highlight.artist}</p>
      </div>
      <div style="align-self: center; width: 48px; height: 48px; background: var(--text-primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--bg-primary);">
        ${icons.play}
      </div>
    `;
    heroCard.addEventListener("click", () =>
      queueManager.playAll(
        recentTracks.length > 0 ? recentTracks : allTracks,
        0,
      ),
    );
    header.appendChild(heroCard);
  }

  page.appendChild(header);

  if (allTracks.length === 0) {
    const isActuallyEmpty = !localStorage.getItem("flow_library_cache");

    if (isActuallyEmpty) {
      renderSkeletonHome(page);
    } else {
      const emptyState = createElement("div", "home-empty-state");
      emptyState.style.display = "flex";
      emptyState.style.flexDirection = "column";
      emptyState.style.alignItems = "center";
      emptyState.style.justifyContent = "center";
      emptyState.style.height = "60vh";
      emptyState.style.textAlign = "center";

      emptyState.innerHTML = `
        <div style="width: 80px; height: 80px; background: rgba(var(--accent-rgb), 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--accent); margin-bottom: var(--sp-6); box-shadow: 0 0 40px rgba(var(--accent-rgb), 0.2);">
          <svg style="width: 40px; height: 40px;" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
        </div>
        <h2 style="font-size: var(--fs-xl); font-weight: 700; margin-bottom: var(--sp-2);">Your Library is Empty</h2>
        <p style="color: var(--text-secondary); max-width: 280px; margin-bottom: var(--sp-8); line-height: 1.5;">
          Import your local music files to start listening. We support MP3, FLAC, and WAV.
        </p>
        <button class="btn btn-primary" id="home-scan-btn" style="padding: 12px 32px; border-radius: 50px; font-weight: 700;">
          ${icons.folder} <span>Select Music Folder</span>
        </button>
      `;
      page.appendChild(emptyState);
      emptyState
        .querySelector("#home-scan-btn")
        .addEventListener("click", () => musicLibrary.pickAndScanFolder());
    }
    return;
  }

  if (recentTracks.length > 0) {
    const section = createHorizontalSection(
      "Recently Played",
      recentTracks.slice(0, 10),
    );
    section.classList.add("fade-in-up");
    page.appendChild(section);
  } else {
    const section = createElement("section", "fade-in-up");
    section.style.marginTop = "var(--sp-8)";
    section.innerHTML = `
      <h2 class="section-title" style="margin-bottom: var(--sp-4); opacity: 0.5;">Recently Played</h2>
      <div class="glass-card" style="padding: 20px; border-radius: 16px; display: flex; align-items: center; gap: 15px; opacity: 0.6; border: 1px dashed var(--border);">
         <div style="width: 40px; height: 40px; background: var(--bg-elevated); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--text-secondary);">
            ${icons.clock || '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-8 8 3.58-8 8-8zm-.22-13h-.06c-.4 0-.72.32-.72.72v4.72c0 .35.18.68.49.86l4.15 2.49c.34.2.78.1.98-.24a.71.71 0 00-.25-.99l-3.87-2.3V7.72c0-.4-.32-.72-.72-.72z"/></svg>'}
         </div>
         <div style="flex: 1;">
            <div style="font-size: 14px; font-weight: 600;">No history yet</div>
            <div style="font-size: 11px; color: var(--text-tertiary);">Start listening to build your timeline.</div>
         </div>
      </div>
    `;
    page.appendChild(section);
  }

  if (mostPlayed.length > 0) {
    const section = createHorizontalSection(
      "Most Played Songs",
      mostPlayed,
      true,
    );
    section.classList.add("fade-in-up");
    page.appendChild(section);
  }

  const freshSection = createElement("section", "fade-in-up");
  freshSection.style.marginTop = "var(--sp-10)";
  freshSection.innerHTML = `<h2 class="section-title" style="margin-bottom: var(--sp-4);">Recently Added</h2>`;

  const grid = createElement("div", "cards-grid");
  recentlyAdded.forEach((track) => {
    const card = createElement("div", "card");
    card.innerHTML = `
      <img class="card-art" src="${track.cover}" alt="">
      <div class="card-title" style="font-size: var(--fs-base);">${cleanTitle(track.title, 30)}</div>
      <div class="card-subtitle">${track.artist}</div>
    `;
    card.addEventListener("click", () => {
      haptics.light();
      queueManager.playAll(recentlyAdded, recentlyAdded.indexOf(track));
    });
    grid.appendChild(card);
  });
  freshSection.appendChild(grid);
  page.appendChild(freshSection);
}

function createHorizontalSection(title, tracks, showPlays = false) {
  const section = createElement("section", "");
  section.style.marginTop = "var(--sp-8)";
  section.innerHTML = `
    <h2 class="section-title" style="margin-bottom: var(--sp-4);">${title}</h2>
    <div class="horizontal-scroll" style="display: flex; gap: var(--sp-4); overflow-x: auto; padding-bottom: var(--sp-4); scrollbar-width: none; -webkit-overflow-scrolling: touch;">
      ${tracks
        .map(
          (t) => `
        <div class="track-card-horizontal" data-id="${t.id}" style="flex: 0 0 140px; cursor: pointer;">
          <div style="position: relative;">
            <img src="${t.cover}" style="width: 140px; height: 140px; border-radius: var(--radius-lg); object-fit: cover; box-shadow: var(--shadow-lg);">
            ${
              showPlays
                ? `<div style="position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 700; color: var(--accent); border: 1px solid rgba(255,255,255,0.1);">${t.plays} plays</div>`
                : ""
            }
          </div>
          <div style="margin-top: var(--sp-2);">
            <div style="font-weight: 600; font-size: var(--fs-sm); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${cleanTitle(t.title, 25)}</div>
            <div style="font-size: var(--fs-xs); color: var(--text-tertiary);">${t.artist}</div>
          </div>
        </div>
      `,
        )
        .join("")}
    </div>
  `;

  section.querySelectorAll(".track-card-horizontal").forEach((card) => {
    card.addEventListener("click", () => {
      const idx = tracks.findIndex((t) => t.id === card.dataset.id);
      if (idx >= 0) queueManager.playAll(tracks, idx);
    });
  });

  return section;
}
function renderSkeletonHome(page) {
  const headerSk = createElement("div", "skeleton-home-header");
  headerSk.style.marginBottom = "var(--sp-10)";
  headerSk.innerHTML = `
    <div class="skeleton" style="height: 32px; width: 200px; margin-bottom: 8px;"></div>
    <div class="skeleton" style="height: 16px; width: 140px; margin-bottom: 24px;"></div>
    <div class="skeleton" style="height: 120px; width: 100%; border-radius: 20px;"></div>
  `;
  page.appendChild(headerSk);

  for (let i = 0; i < 2; i++) {
    const sectionSk = createElement("div", "skeleton-section");
    sectionSk.style.marginTop = "var(--sp-8)";
    sectionSk.innerHTML = `
      <div class="skeleton" style="height: 24px; width: 180px; margin-bottom: 16px;"></div>
      <div style="display: flex; gap: 16px; overflow: hidden;">
        ${[1, 2, 3, 4]
          .map(
            () => `
          <div style="flex: 0 0 140px;">
            <div class="skeleton skeleton-art" style="margin-bottom: 8px;"></div>
            <div class="skeleton" style="height: 14px; width: 100px; margin-bottom: 4px;"></div>
            <div class="skeleton" style="height: 10px; width: 60px;"></div>
          </div>
        `,
          )
          .join("")}
      </div>
    `;
    page.appendChild(sectionSk);
  }
}
