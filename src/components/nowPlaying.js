import { Capacitor, registerPlugin } from "@capacitor/core";
import { icons } from "../core/icons.js";
import { audioEngine } from "../core/audioEngine.js";
import { queueManager } from "../core/queue.js";
import { musicLibrary } from "../core/library.js";
import { store } from "../core/store.js";
import { router } from "../router.js";
import {
  formatTime,
  createElement,
  cleanTitle,
  getDominantColors,
  rgbToHex,
} from "../core/utils.js";
import { lrcHandler } from "../core/lrcHandler.js";

let progressDragging = false;
let currentLyrics = [];
let lyricsActive = false;

export function createNowPlaying() {
  const el = createElement("div", "now-playing");
  el.id = "now-playing";

  el.innerHTML = `
    <div class="now-playing-bg" id="np-bg"></div>
    <div class="now-playing-content">
      <div class="now-playing-header">
        <button class="now-playing-close" id="np-close">${icons.chevronDown}</button>
        <div style="display: flex; flex-direction: column; align-items: center; min-width: 0;">
          <span class="now-playing-source" id="np-source">Playing from Library</span>
          <div id="np-timer" class="hidden" style="font-size: 10px; font-weight: 700; color: var(--accent); margin-top: 2px;"></div>
        </div>
        <button class="now-playing-menu" id="np-menu">${icons.moreVert}</button>
      </div>

      <div class="now-playing-pages-wrapper" id="np-pages-wrapper">
        <div class="now-playing-pages" id="np-pages">
          <div class="now-playing-page" id="np-page-art">
            <img class="now-playing-art" id="np-art" src="" alt="">
          </div>
          <div class="now-playing-page" id="np-page-lyrics">
            <div class="now-playing-lyrics" id="np-lyrics">
              <div class="lyrics-scroll" id="np-lyrics-content"></div>
            </div>
          </div>
        </div>
        <div class="np-pager-dots">
          <div class="np-dot active" data-index="0"></div>
          <div class="np-dot" data-index="1"></div>
        </div>
      </div>

      <div class="now-playing-info">
        <div class="now-playing-details">
          <div class="now-playing-title" id="np-title">Not Playing</div>
          <div class="now-playing-artist" id="np-artist"></div>
        </div>
        <button class="now-playing-like" id="np-like">${icons.heart}</button>
      </div>

      <div class="progress-container">
        <div class="progress-bar-wrapper" id="np-progress-wrapper">
          <div class="progress-bar-fill" id="np-progress-fill" style="width: 0%">
            <div class="progress-bar-thumb"></div>
          </div>
        </div>
        <div class="progress-times">
          <span id="np-time-current">0:00</span>
          <span id="np-time-total">0:00</span>
        </div>
      </div>

      <div class="now-playing-controls">
        <button class="control-btn" id="np-shuffle" aria-label="Shuffle">${icons.shuffle}</button>
        <button class="control-btn control-btn-skip" id="np-prev" aria-label="Previous">${icons.skipPrev}</button>
        <button class="control-btn-play" id="np-play" aria-label="Play">${icons.play}</button>
        <button class="control-btn control-btn-skip" id="np-next" aria-label="Next">${icons.skipNext}</button>
        <button class="control-btn" id="np-repeat" aria-label="Repeat">${icons.repeat}</button>
      </div>

      <div class="now-playing-bottom">
        <button id="np-volume" aria-label="Volume">${icons.volumeUp}</button>
        <button id="np-queue" aria-label="Queue">${icons.queue}</button>
        <button id="np-share" aria-label="Share">${icons.share}</button>
      </div>
    </div>
  `;

  el.querySelector("#np-close").addEventListener("click", () => {
    store.set("nowPlayingOpen", false);
  });

  el.querySelector("#np-play").addEventListener("click", () => {
    audioEngine.togglePlay();
  });

  el.querySelector("#np-prev").addEventListener("click", () => {
    queueManager.playPrev();
  });

  el.querySelector("#np-next").addEventListener("click", () => {
    queueManager.playNext();
  });

  el.querySelector("#np-shuffle").addEventListener("click", () => {
    const enabled = queueManager.toggleShuffle();
    store.showToast(enabled ? "Shuffle On 🔀 (Repeat Off)" : "Shuffle Off");
  });

  el.querySelector("#np-repeat").addEventListener("click", () => {
    const mode = queueManager.toggleRepeat();
    const isStopAfter = audioEngine.stopAfterCurrent;

    let message = "";
    if (mode === "off" && isStopAfter) message = "Play Once (Current) ⏹️";
    else if (mode === "off" && !isStopAfter) message = "Play to End 🏁";
    else if (mode === "all") message = "Repeat All 🔁";
    else if (mode === "one") message = "Repeat One 🔂";

    store.showToast(message);
  });

  el.querySelector("#np-like").addEventListener("click", () => {
    const track = queueManager.getCurrentTrack();
    if (track) {
      const liked = musicLibrary.toggleFavorite(track.id);
      updateLikeButton(el, liked);
      store.showToast(
        liked ? "Added to Liked Songs" : "Removed from Liked Songs",
      );
    }
  });

  el.querySelector("#np-queue").addEventListener("click", () => {
    store.set("nowPlayingOpen", false);
    router.navigate("#/queue");
  });

  el.querySelector("#np-volume").addEventListener("click", () => {
    if (Capacitor.isNativePlatform()) {
      registerPlugin("ZNowPlaying")
        .showVolume()
        .catch(() => showVolumeModal());
    } else {
      showVolumeModal();
    }
  });

  el.querySelector("#np-share").addEventListener("click", () => {
    const track = queueManager.getCurrentTrack();
    if (track) shareTrack(track);
  });

  el.querySelector("#np-menu").addEventListener("click", () => {
    const track = queueManager.getCurrentTrack();
    if (track) {
      store.set("contextMenu", { track });
    }
  });

  let currentPage = 0;
  const pages = el.querySelector("#np-pages");
  const dots = el.querySelectorAll(".np-dot");
  const lyricsContainer = el.querySelector("#np-lyrics");
  const lyricsContent = el.querySelector("#np-lyrics-content");

  const scrollToPage = (index) => {
    currentPage = index;
    pages.style.transform = `translateX(-${index * 50}%)`;
    dots.forEach((dot, i) => dot.classList.toggle("active", i === index));
    if (index === 1) {
      lyricsActive = true;
      syncLyrics(audioEngine.currentTime);
    } else {
      lyricsActive = false;
    }
  };

  let startX = 0;
  let startY = 0;
  let moveX = 0;
  let moveY = 0;
  let isSwiping = false;
  let isScrolling = false;
  const pagesWrapper = el.querySelector("#np-pages-wrapper");

  pagesWrapper.addEventListener(
    "touchstart",
    (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      isSwiping = false;
      isScrolling = false;
      pages.style.transition = "none";
    },
    { passive: true },
  );

  pagesWrapper.addEventListener(
    "touchmove",
    (e) => {
      moveX = e.touches[0].clientX - startX;
      moveY = e.touches[0].clientY - startY;

      if (isScrolling) return;

      if (!isSwiping) {
        if (Math.abs(moveX) > Math.abs(moveY) && Math.abs(moveX) > 10) {
          isSwiping = true;
        } else if (Math.abs(moveY) > Math.abs(moveX) && Math.abs(moveY) > 10) {
          isScrolling = true;
          return;
        }
      }

      if (isSwiping) {
        const offset = -currentPage * pagesWrapper.offsetWidth + moveX;
        if (offset > 0 || offset < -pagesWrapper.offsetWidth) {
          pages.style.transform = `translateX(${offset / 2}px)`;
        } else {
          pages.style.transform = `translateX(${offset}px)`;
        }
      }
    },
    { passive: true },
  );

  pagesWrapper.addEventListener("touchend", () => {
    if (isSwiping) {
      pages.style.transition =
        "transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.1)";
      if (Math.abs(moveX) > 50) {
        if (moveX < 0 && currentPage === 0) scrollToPage(1);
        else if (moveX > 0 && currentPage === 1) scrollToPage(0);
        else scrollToPage(currentPage);
      } else {
        scrollToPage(currentPage);
      }
    }
    startX = 0;
    startY = 0;
    moveX = 0;
    moveY = 0;
    isSwiping = false;
    isScrolling = false;
  });

  dots.forEach((dot) => {
    dot.addEventListener("click", () => {
      scrollToPage(parseInt(dot.dataset.index));
    });
  });

  const progressWrapper = el.querySelector("#np-progress-wrapper");
  const progressFill = el.querySelector("#np-progress-fill");
  const timeCurrent = el.querySelector("#np-time-current");
  let dragTime = 0;

  const updateVisualProgress = (e) => {
    const rect = progressWrapper.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    dragTime = pct * (audioEngine.duration || 0);

    progressFill.style.width = pct * 100 + "%";
    timeCurrent.textContent = formatTime(dragTime);
  };

  const startDrag = (e) => {
    progressDragging = true;
    el.classList.add("is-dragging");
    updateVisualProgress(e);
  };

  const endDrag = () => {
    if (progressDragging) {
      audioEngine.seek(dragTime);
      progressDragging = false;
      el.classList.remove("is-dragging");
    }
  };

  progressWrapper.addEventListener("mousedown", startDrag);
  progressWrapper.addEventListener("touchstart", startDrag, { passive: true });

  window.addEventListener("mousemove", (e) => {
    if (progressDragging) updateVisualProgress(e);
  });
  window.addEventListener(
    "touchmove",
    (e) => {
      if (progressDragging) updateVisualProgress(e);
    },
    { passive: true },
  );

  window.addEventListener("mouseup", endDrag);
  window.addEventListener("touchend", endDrag);

  audioEngine.on("trackchange", ({ track }) => {
    updateNowPlayingUI(el, track);
    loadLyrics(track);
  });
  audioEngine.on("play", () => {
    el.querySelector("#np-play").innerHTML = icons.pause;
  });
  audioEngine.on("pause", () => {
    el.querySelector("#np-play").innerHTML = icons.play;
  });
  audioEngine.on("timeupdate", ({ currentTime, duration }) => {
    if (!progressDragging && duration > 0) {
      const pct = (currentTime / duration) * 100;
      el.querySelector("#np-progress-fill").style.width = pct + "%";
      el.querySelector("#np-time-current").textContent =
        formatTime(currentTime);
      el.querySelector("#np-time-total").textContent = formatTime(duration);
      if (lyricsActive) {
        syncLyrics(currentTime);
      }
    }
  });

  async function loadLyrics(track) {
    currentLyrics = [];
    lyricsContent.innerHTML =
      '<div class="lyric-line loading">Looking for lyrics...</div>';

    let lyrics = null;

    if (!lyrics && Capacitor.isNativePlatform() && track.src) {
      let lrcPath = "";
      if (track.src.startsWith("file://")) {
        lrcPath = track.src.replace("file://", "").split("?")[0];
      } else if (track.src.startsWith("/")) {
        lrcPath = track.src.split("?")[0];
      }

      if (lrcPath) {
        const localLrc =
          lrcPath.substring(0, lrcPath.lastIndexOf(".")) + ".lrc";
        lyrics = await lrcHandler.fetchFromDevice(localLrc);
      }
    }

    if (!lyrics && Capacitor.isNativePlatform()) {
      try {
        const { Directory } = await import("@capacitor/filesystem");
        const filename = `${track.id}.lrc`;
        lyrics = await lrcHandler.fetchFromDevice(filename, Directory.Data);
      } catch (e) {}
    }

    if (!lyrics) {
      const filename = track.src.split("/").pop().split(".")[0];
      const lrcPath = `./assets/lyrics/${filename}.lrc`;
      lyrics = await lrcHandler.fetch(lrcPath);
    }

    if (lyrics) {
      currentLyrics = lyrics;
      renderLyrics();
    } else {
      lyricsContent.innerHTML =
        '<div class="lyric-line no-lyrics">No lyrics found</div>';
    }
  }

  function renderLyrics() {
    lyricsContent.innerHTML = currentLyrics
      .map(
        (line, index) =>
          `<div class="lyric-line" data-index="${index}" data-time="${line.time}">${line.text}</div>`,
      )
      .join("");

    lyricsContent.querySelectorAll(".lyric-line").forEach((line) => {
      line.addEventListener("click", (e) => {
        e.stopPropagation();
        const time = parseFloat(line.dataset.time);
        if (!isNaN(time)) {
          audioEngine.seek(time);
          if (!audioEngine.isPlaying) audioEngine.play();
        }
      });
    });
  }

  function syncLyrics(time) {
    if (!currentLyrics.length) return;

    let activeIndex = -1;
    for (let i = 0; i < currentLyrics.length; i++) {
      if (time >= currentLyrics[i].time) {
        activeIndex = i;
      } else {
        break;
      }
    }

    if (activeIndex !== -1) {
      const lines = lyricsContent.querySelectorAll(".lyric-line");
      lines.forEach((line, i) => {
        line.classList.toggle("active", i === activeIndex);
        line.classList.toggle("past", i < activeIndex);
      });

      const activeLine = lines[activeIndex];
      if (activeLine) {
        const wrapperHeight = lyricsContainer.offsetHeight;
        const lineOffset = activeLine.offsetTop;
        const lineHeight = activeLine.offsetHeight;

        lyricsContent.style.transform = `translateY(${wrapperHeight / 2 - lineOffset - lineHeight / 2}px)`;
      }
    }
  }

  audioEngine.on("shufflechange", ({ enabled }) => {
    el.querySelector("#np-shuffle").className =
      `control-btn${enabled ? " active" : ""}`;
  });

  audioEngine.on("repeatchange", ({ mode, stopAfterCurrent }) => {
    const btn = el.querySelector("#np-repeat");
    const isActive = mode !== "off" || stopAfterCurrent;
    btn.className = `control-btn${isActive ? " active" : ""}`;

    if (mode === "one") {
      btn.innerHTML = icons.repeatOne;
    } else {
      btn.innerHTML = icons.repeat;
    }
  });

  audioEngine.on("sleeptimer", ({ remaining }) => {
    const timerEl = el.querySelector("#np-timer");
    if (!timerEl) return;

    if (remaining > 0) {
      const totalSec = Math.ceil(remaining / 1000);
      const m = Math.floor(totalSec / 60);
      const s = totalSec % 60;
      timerEl.textContent = `SLEEP TIMER: ${m}:${s.toString().padStart(2, "0")}`;
      timerEl.classList.remove("hidden");
    } else {
      timerEl.classList.add("hidden");
    }
  });

  let touchStartY = 0;
  el.addEventListener(
    "touchstart",
    (e) => {
      if (
        e.target.closest(".progress-bar-wrapper") ||
        e.target.closest(".control-btn") ||
        e.target.closest("input")
      )
        return;
      touchStartY = e.touches[0].clientY;
    },
    { passive: true },
  );

  el.addEventListener(
    "touchmove",
    (e) => {
      if (touchStartY === 0) return;
      const deltaY = e.touches[0].clientY - touchStartY;
      if (deltaY > 100) {
        store.set("nowPlayingOpen", false);
        touchStartY = 0;
      }
    },
    { passive: true },
  );

  el.addEventListener("touchend", () => {
    touchStartY = 0;
  });

  store.on("nowPlayingOpen", (open) => {
    if (open) {
      el.classList.add("open");
      document.body.style.overflow = "hidden";
    } else {
      el.classList.remove("open");
      document.body.style.overflow = "";
    }
  });

  musicLibrary.on("updated", () => {
    const track = queueManager.getCurrentTrack();
    if (track) {
      updateNowPlayingUI(el, track);
      loadLyrics(track);
    }
  });

  const initialTrack = queueManager.getCurrentTrack();
  if (initialTrack) {
    updateNowPlayingUI(el, initialTrack);
    loadLyrics(initialTrack);
  }

  return el;
}

function updateNowPlayingUI(el, track) {
  el.querySelector("#np-art").src = track.cover || "";
  el.querySelector("#np-title").textContent = cleanTitle(track.title, 40);
  el.querySelector("#np-artist").textContent = track.artist;
  updateLikeButton(el, musicLibrary.isFavorite(track.id));

  const bg = el.querySelector("#np-bg");
  if (track.cover) {
    getDominantColors(track.cover).then(([c1, c2]) => {
      const hex1 = rgbToHex(c1.r, c1.g, c1.b);
      const hex2 = rgbToHex(c2.r, c2.g, c2.b);
      bg.style.setProperty("--np-bg-color-1", hex1);
      bg.style.setProperty("--np-bg-color-2", hex2);
    });
  } else {
    bg.style.setProperty("--np-bg-color-1", "#121212");
    bg.style.setProperty("--np-bg-color-2", "#1a1a1a");
  }
}

function updateLikeButton(el, liked) {
  const btn = el.querySelector("#np-like");
  btn.className = `now-playing-like${liked ? " liked" : ""}`;
  btn.innerHTML = liked ? icons.heartFill : icons.heart;
}

function showVolumeModal() {
  const content = createElement("div", "volume-modal-content");
  const currentVol = Math.round(audioEngine.volume * 100);

  content.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: var(--sp-6); align-items: center; padding: var(--sp-2) 0;">
      <div style="font-size: var(--fs-4xl); color: var(--accent);">${icons.volumeUp}</div>
      <div style="width: 100%; display: flex; align-items: center; gap: var(--sp-4);">
        <span style="font-size: var(--fs-xs); width: 30px; text-align: right;">${currentVol}%</span>
        <input type="range" id="modal-volume-slider" min="0" max="100" step="1" value="${currentVol}" style="flex: 1; accent-color: var(--accent);">
      </div>
      <p style="font-size: var(--fs-xs); color: var(--text-tertiary); text-align: center;">Master Volume Control</p>
    </div>
  `;

  const slider = content.querySelector("#modal-volume-slider");
  const label = content.querySelector("span");

  slider.addEventListener("input", (e) => {
    const val = parseInt(e.target.value);
    audioEngine.setVolume(val / 100);
    label.textContent = `${val}%`;
  });

  store.set("modal", {
    title: "Volume",
    content: content,
  });
}

async function shareTrack(track) {
  const shareData = {
    title: track.title,
    text: `Listening to ${track.title} by ${track.artist} on Flow Music.`,
    url: "https://github.com/Flow-Music",
    dialogTitle: "Share this track",
  };

  try {
    const { Share } = await import("@capacitor/share");
    await Share.share(shareData);
  } catch (e) {
    if (navigator.share) {
      navigator.share(shareData).catch(() => {});
    } else {
      store.showToast("Sharing not supported on this browser.");
    }
  }
}
