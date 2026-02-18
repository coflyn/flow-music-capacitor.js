import { icons } from "../core/icons.js";
import { audioEngine } from "../core/audioEngine.js";
import { queueManager } from "../core/queue.js";
import { musicLibrary } from "../core/library.js";
import { store } from "../core/store.js";
import { createElement, formatTime } from "../core/utils.js";
import { haptics } from "../core/haptics.js";

export function renderQueue(container) {
  container.innerHTML = "";
  const page = createElement("div", "page");

  page.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--sp-6);">
      <h1 class="page-title">Queue</h1>
      <button class="btn btn-secondary" id="clear-queue-btn" style="font-size: var(--fs-sm); display: none;">Clear</button>
    </div>
    <div id="queue-content"></div>
  `;

  container.appendChild(page);

  const updateQueueUI = () => {
    if (!document.body.contains(page)) {
      queueManager.off("queuechange", updateQueueUI);
      queueManager.off("trackchange", updateQueueUI);
      audioEngine.off("shufflechange", updateQueueUI);
      audioEngine.off("repeatchange", updateQueueUI);
      return;
    }
    const content = page.querySelector("#queue-content");
    if (content) renderQueueContent(content);

    const clearBtn = page.querySelector("#clear-queue-btn");
    const upcoming = queueManager.getUpcoming();
    if (clearBtn) {
      clearBtn.style.display = upcoming.length > 0 ? "block" : "none";
    }
  };

  queueManager.on("queuechange", updateQueueUI);
  queueManager.on("trackchange", updateQueueUI);
  audioEngine.on("shufflechange", updateQueueUI);
  audioEngine.on("repeatchange", updateQueueUI);
  musicLibrary.on("updated", updateQueueUI);

  page.querySelector("#clear-queue-btn").addEventListener("click", () => {
    queueManager.clearUpcoming();
    updateQueueUI();
  });

  updateQueueUI();
}

function renderQueueContent(contentEl) {
  contentEl.innerHTML = "";

  const current = queueManager.getCurrentTrack();
  const upcoming = queueManager.getUpcoming();
  const isShuffle = audioEngine.shuffleMode;
  const repeatMode = audioEngine.repeatMode;
  const isStopAfter = audioEngine.stopAfterCurrent;

  const modeBar = createElement("div", "queue-mode-bar");

  const shuffleBtn = createElement(
    "button",
    `control-btn${isShuffle ? " active" : ""}`,
  );
  shuffleBtn.innerHTML = icons.shuffle;
  shuffleBtn.addEventListener("click", () => {
    queueManager.toggleShuffle();
    haptics.light();
  });

  const repeatBtn = createElement(
    "button",
    `control-btn${repeatMode !== "off" || isStopAfter ? " active" : ""}`,
  );
  repeatBtn.innerHTML = repeatMode === "one" ? icons.repeatOne : icons.repeat;
  repeatBtn.addEventListener("click", () => {
    queueManager.toggleRepeat();
    haptics.light();
  });

  let modeText = "Play to End 🏁";
  if (isShuffle) modeText = "Shuffle On 🔀";
  else if (isStopAfter) modeText = "Play Once ⏹️";
  else if (repeatMode === "all") modeText = "Repeat All 🔁";
  else if (repeatMode === "one") modeText = "Repeat One 🔂";

  const statusText = createElement("span", "queue-mode-text");
  statusText.textContent = modeText;

  modeBar.appendChild(shuffleBtn);
  modeBar.appendChild(repeatBtn);
  modeBar.appendChild(statusText);
  contentEl.appendChild(modeBar);

  if (!current && upcoming.length === 0) {
    const empty = createElement("div", "empty-state");
    empty.style.padding = "40px 0";
    empty.innerHTML = `
        <div class="empty-state-icon">${icons.queue}</div>
        <div class="empty-state-title">Queue is empty</div>
        <div class="empty-state-text">Play something to get started</div>
    `;
    contentEl.appendChild(empty);
    return;
  }

  if (current) {
    const nowSection = createElement("div", "");
    nowSection.innerHTML = `<h3 class="settings-group-title" style="padding-left: 0; padding-top: 0;">Now Playing</h3>`;
    const item = createQueueItem(current, queueManager.currentIndex, true);
    nowSection.appendChild(item);
    contentEl.appendChild(nowSection);
  }

  if (upcoming.length > 0) {
    const nextSection = createElement("div", "");
    nextSection.style.marginTop = "24px";
    nextSection.style.opacity = isStopAfter ? "0.4" : "1";

    const header = createElement("div", "");
    header.style.cssText =
      "display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;";
    header.innerHTML = `
      <h3 class="settings-group-title" style="padding: 0;">Up Next · ${upcoming.length} tracks</h3>
      ${isStopAfter ? '<span class="stop-badge">STOP AFTER THIS</span>' : ""}
    `;

    nextSection.appendChild(header);

    upcoming.forEach((track) => {
      const item = createQueueItem(track, track.queueIndex, false);
      nextSection.appendChild(item);
    });

    contentEl.appendChild(nextSection);
  }

  if (repeatMode === "all" && upcoming.length > 0) {
    const footer = createElement("div", "queue-footer");
    footer.innerHTML = `${icons.repeat} Back to start of queue`;
    contentEl.appendChild(footer);
  }
}

function createQueueItem(track, queueIndex, isCurrent) {
  const isFav = musicLibrary.isFavorite(track.id);
  const item = createElement("div", `track-item${isCurrent ? " playing" : ""}`);

  item.innerHTML = `
    <div class="track-number-col">
      ${
        !isCurrent
          ? `<div class="drag-handle">${icons.dragHandle || '<svg viewBox="0 0 24 24" fill="currentColor" style="width:20px;height:20px;"><path d="M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>'}</div>`
          : isCurrent && audioEngine.isPlaying
            ? `
        <div class="eq-bars">
          <div class="eq-bar"></div>
          <div class="eq-bar"></div>
          <div class="eq-bar"></div>
          <div class="eq-bar"></div>
        </div>
      `
            : `
        <span class="track-play-icon" style="visibility: visible;">${icons.play}</span>
      `
      }
    </div>
    <img class="track-art" src="${track.cover || ""}" alt="${track.title}" loading="lazy" onerror="this.style.display='none'">
    <div class="track-info">
      <div class="track-title">${track.title}</div>
      <div class="track-artist">${track.artist}</div>
    </div>
    <div class="track-meta">
      <span class="track-duration">${formatTime(track.duration)}</span>
      ${
        !isCurrent
          ? `
        <button class="track-more" data-action="remove" style="padding: 4px; color: var(--text-tertiary);">
          ${icons.close}
        </button>
      `
          : ""
      }
    </div>
  `;

  item.addEventListener("click", (e) => {
    if (e.target.closest('[data-action="remove"]')) return;
    if (isCurrent) {
      audioEngine.togglePlay();
    } else {
      queueManager.currentIndex = queueIndex;
      queueManager._playCurrentTrack();
    }
  });

  const removeBtn = item.querySelector('[data-action="remove"]');
  if (removeBtn) {
    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      queueManager.removeFromQueue(queueIndex);
    });
  }

  if (!isCurrent) {
    const handle = item.querySelector(".drag-handle");
    let initialY = 0;
    let currentY = 0;
    let draggedIndex = queueIndex;

    const onTouchStart = (e) => {
      initialY = e.touches[0].clientY;
      item.classList.add("dragging");
      item.style.transition = "none";
      document.body.style.overflow = "hidden";
    };

    const onTouchMove = (e) => {
      currentY = e.touches[0].clientY;
      const deltaY = currentY - initialY;
      item.style.transform = `translateY(${deltaY}px)`;

      const siblings = Array.from(item.parentNode.children).filter(
        (el) => el !== item && el.classList.contains("track-item"),
      );
      const nextSibling = siblings.find((sib) => {
        const rect = sib.getBoundingClientRect();
        return currentY < rect.top + rect.height / 2;
      });

      siblings.forEach((s) =>
        s.classList.remove("drag-over-top", "drag-over-bottom"),
      );
      if (nextSibling) {
        nextSibling.classList.add("drag-over-top");
      } else if (siblings.length > 0) {
        siblings[siblings.length - 1].classList.add("drag-over-bottom");
      }
    };

    const onTouchEnd = (e) => {
      item.classList.remove("dragging");
      item.style.transform = "";
      item.style.transition = "";
      document.body.style.overflow = "";

      const siblings = Array.from(item.parentNode.children).filter((el) =>
        el.classList.contains("track-item"),
      );

      const currentPosInSiblings = siblings.indexOf(item);
      const finalIndexInCurrentList = siblings.findIndex((sib) => {
        if (sib === item) return false;
        const rect = sib.getBoundingClientRect();
        return currentY < rect.top + rect.height / 2;
      });

      siblings.forEach((s) =>
        s.classList.remove("drag-over-top", "drag-over-bottom"),
      );

      let toIndex;
      if (finalIndexInCurrentList === -1) {
        toIndex = queueManager.currentIndex + siblings.length - 1;
      } else {
        toIndex = queueManager.currentIndex + 1 + finalIndexInCurrentList;
        if (currentPosInSiblings < finalIndexInCurrentList) {
          toIndex--;
        }
      }

      if (toIndex !== queueIndex) {
        haptics.light();
        queueManager.reorderQueue(queueIndex, toIndex);
      }
    };

    handle.addEventListener("touchstart", onTouchStart, { passive: true });
    handle.addEventListener("touchmove", onTouchMove, { passive: true });
    handle.addEventListener("touchend", onTouchEnd);
  }

  return item;
}
