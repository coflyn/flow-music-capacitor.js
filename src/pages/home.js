import { icons } from "../core/icons.js";
import { musicLibrary } from "../core/library.js";
import { queueManager } from "../core/queue.js";
import { createElement, cleanTitle } from "../core/utils.js";
import { router } from "../router.js";

export function renderHome(container) {
  container.innerHTML = "";
  const page = createElement("div", "page animate-in");

  const hour = new Date().getHours();
  let greeting = "Good morning";
  if (hour >= 12 && hour < 17) greeting = "Good afternoon";
  else if (hour >= 17 || hour < 4) greeting = "Good evening";
  else if (hour >= 4 && hour < 12) greeting = "Good morning";

  const allTracks = musicLibrary.getAllTracks();
  const recentTracks = musicLibrary.getRecentlyPlayed();
  const mostPlayed = musicLibrary.getMostPlayed(6);
  const recentlyAdded = musicLibrary.getRecentlyAdded(8);

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
    const emptyState = createElement("div", "home-empty-state");
    emptyState.innerHTML = `
      <div class="empty-icon">${icons.music}</div>
      <h2 class="empty-title">Digital silence</h2>
      <button class="btn btn-primary" id="home-scan-btn" style="margin-top: var(--sp-6);">
        ${icons.folder} Select Music Folder
      </button>
    `;
    page.appendChild(emptyState);
    emptyState
      .querySelector("#home-scan-btn")
      .addEventListener("click", () => musicLibrary.pickAndScanFolder());
    container.appendChild(page);
    return;
  }

  if (recentTracks.length > 0) {
    const section = createHorizontalSection(
      "Recently Played",
      recentTracks.slice(0, 10),
    );
    section.classList.add("fade-in-up"); // Standard sub-transition if needed
    page.appendChild(section);
  }

  if (mostPlayed.length > 0) {
    const section = createHorizontalSection("Your Heavy Rotation", mostPlayed);
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
    card.addEventListener("click", () =>
      queueManager.playAll(recentlyAdded, recentlyAdded.indexOf(track)),
    );
    grid.appendChild(card);
  });
  freshSection.appendChild(grid);
  page.appendChild(freshSection);

  container.appendChild(page);
}

function createHorizontalSection(title, tracks) {
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
