import { icons } from "../core/icons.js";
import { audioEngine } from "../core/audioEngine.js";
import { queueManager } from "../core/queue.js";
import { store } from "../core/store.js";
import { musicLibrary } from "../core/library.js";
import { haptics } from "../core/haptics.js";
import { createElement, cleanTitle } from "../core/utils.js";

export function createMiniPlayer() {
  const el = createElement("div", "mini-player hidden");
  el.id = "mini-player";

  el.innerHTML = `
    <div class="mini-player-progress" id="mini-progress" style="width: 0%"></div>
    <img class="mini-player-art" id="mini-art" src="" alt="">
    <div class="mini-player-info">
      <div class="mini-player-title" id="mini-title">Not Playing</div>
      <div class="mini-player-artist" id="mini-artist"></div>
    </div>
    <div class="mini-player-controls">
      <button id="mini-prev" aria-label="Previous">${icons.skipPrev}</button>
      <button id="mini-play" aria-label="Play">${icons.play}</button>
      <button id="mini-next" aria-label="Next">${icons.skipNext}</button>
    </div>
  `;

  el.addEventListener("click", (e) => {
    if (e.target.closest(".mini-player-controls")) return;
    store.set("nowPlayingOpen", true);
  });

  el.querySelector("#mini-play").addEventListener("click", (e) => {
    e.stopPropagation();
    haptics.light();
    audioEngine.togglePlay();
  });

  el.querySelector("#mini-prev").addEventListener("click", (e) => {
    e.stopPropagation();
    haptics.light();
    queueManager.playPrev();
  });

  el.querySelector("#mini-next").addEventListener("click", (e) => {
    e.stopPropagation();
    haptics.light();
    queueManager.playNext();
  });

  audioEngine.on("trackchange", ({ track }) => {
    el.classList.remove("hidden");
    el.querySelector("#mini-art").src = track.cover || "";
    el.querySelector("#mini-title").textContent = cleanTitle(track.title, 30);
    el.querySelector("#mini-artist").textContent = track.artist;
  });

  audioEngine.on("play", () => {
    el.querySelector("#mini-play").innerHTML = icons.pause;
  });

  audioEngine.on("pause", () => {
    el.querySelector("#mini-play").innerHTML = icons.play;
  });

  audioEngine.on("timeupdate", ({ currentTime, duration }) => {
    if (duration > 0) {
      const pct = (currentTime / duration) * 100;
      el.querySelector("#mini-progress").style.width = pct + "%";
    }
  });

  musicLibrary.on("updated", () => {
    const track = queueManager.getCurrentTrack();
    if (track && !el.classList.contains("hidden")) {
      el.querySelector("#mini-title").textContent = cleanTitle(track.title, 30);
      el.querySelector("#mini-artist").textContent = track.artist;
    }
  });

  return el;
}
