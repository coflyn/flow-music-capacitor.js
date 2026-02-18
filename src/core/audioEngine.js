import { Capacitor, registerPlugin } from "@capacitor/core";
import { store } from "./store.js";

const NowPlaying = Capacitor.isNativePlatform()
  ? registerPlugin("ZNowPlaying")
  : null;

class AudioEngine {
  constructor() {
    this.audioA = new Audio();
    this.audioB = new Audio();
    this.audioA.preload = "auto";
    this.audioB.preload = "auto";

    this.activePlayer = this.audioA;
    this.nextPlayer = this.audioB;

    this.currentTrack = null;
    this.nextTrack = null;
    this.isPlaying = false;
    this.currentTime = 0;
    this.duration = 0;
    this.volume = 1;
    this.repeatMode = "off";
    this.shuffleMode = false;
    this.stopAfterCurrent = false;

    this.crossfadeDuration =
      parseFloat(localStorage.getItem("flow_crossfade")) || 1.5;
    this.accentColor = localStorage.getItem("flow_accent_color") || "#1db954";
    this.sleepTimer = null;
    this.sleepTimerRemaining = 0;
    this._sleepInterval = null;
    this.stopAfterCurrent = false;

    this.pauseOnDisconnect =
      localStorage.getItem("flow_pause_disconnect") !== "false";
    this.playOnConnect = localStorage.getItem("flow_play_connect") === "true";
    this.avoidShortTracks =
      localStorage.getItem("flow_avoid_short") !== "false";
    this.minTrackDuration =
      parseInt(localStorage.getItem("flow_min_duration")) || 30;

    this.consecutiveErrorCount = 0;
    this._transitionedFrom = null;
    this._changingTrack = false;
    this._pendingNextTimeout = null;
    this._currentTransitionId = 0;

    this._listeners = {};

    this._setupAudioEvents(this.audioA);
    this._setupAudioEvents(this.audioB);
    this._setupMediaSession();
    this._setupNativeListener();
  }

  _setupAudioEvents(player) {
    player.addEventListener("timeupdate", () => {
      if (player !== this.activePlayer || this._changingTrack) return;

      this.currentTime = player.currentTime;
      this.duration = player.duration || 0;

      this._emit("timeupdate", {
        currentTime: this.currentTime,
        duration: this.duration,
      });

      if (Math.floor(this.currentTime) % 1 === 0) {
        this._updateMediaPosition();
      }

      if (
        this.nextTrack &&
        !this.isCrossfading &&
        isFinite(this.duration) &&
        this.duration > 2 &&
        isFinite(this.currentTime) &&
        this.currentTime > 1
      ) {
        const remaining = this.duration - this.currentTime;
        const triggerPoint = Math.max(0.1, this.crossfadeDuration);
        if (remaining <= triggerPoint && this.repeatMode !== "one") {
          this._startTransition();
        }
      }
    });

    player.addEventListener("loadedmetadata", () => {
      if (player === this.activePlayer) {
        if (this.currentTrack && player.src.includes(this.currentTrack.src)) {
          this.duration = player.duration;
          this._emit("loaded", { duration: this.duration });
        }
      }
    });

    player.addEventListener("ended", () => {
      if (player !== this.activePlayer) return;

      if (this.isCrossfading || this._changingTrack) {
        console.warn("Ended fired while state was busy. Forcing reset.");
        this.isCrossfading = false;
        this._changingTrack = false;
      }

      this._handleTrackEnd();
    });

    player.addEventListener("play", () => {
      if (player === this.activePlayer) {
        this.isPlaying = true;
        this.consecutiveErrorCount = 0;
        this._emit("play", { track: this.currentTrack });
        if ("mediaSession" in navigator)
          navigator.mediaSession.playbackState = "playing";
        this._updateNativePlaybackState(true);
      }
    });

    player.addEventListener("pause", () => {
      if (
        player === this.activePlayer &&
        !this.isCrossfading &&
        !this._changingTrack
      ) {
        this.isPlaying = false;
        this._emit("pause", { track: this.currentTrack });
        this._updatePlaybackState();
        this._updateNativePlaybackState(false);
      }
    });

    player.addEventListener("error", (e) => {
      if (this._changingTrack) return;

      if (
        player.error &&
        (player.error.code === 4 || player.error.name === "AbortError")
      )
        return;

      const transitionId = this._currentTransitionId;
      console.error("Audio error:", e);

      if (player === this.activePlayer) {
        this.consecutiveErrorCount++;

        if (this.consecutiveErrorCount >= 5) {
          this.pause();
          this._emit("toast", {
            message: "Multiple playback failures. Stopping. 🛑",
          });
          this.consecutiveErrorCount = 0;
          return;
        }

        this._emit("error", { error: e });
        this._scheduleNext(transitionId);
      }
    });
  }

  _scheduleNext(transitionId, delay = 500) {
    this._clearPendingNext();
    this._pendingNextTimeout = setTimeout(() => {
      if (this._currentTransitionId !== transitionId) return;

      this._emit("next");
      this._pendingNextTimeout = null;
    }, delay);
  }

  _clearPendingNext() {
    if (this._pendingNextTimeout) {
      clearTimeout(this._pendingNextTimeout);
      this._pendingNextTimeout = null;
    }
  }

  _setupMediaSession() {
    if ("mediaSession" in navigator) {
      navigator.mediaSession.setActionHandler("play", () => this.resume());
      navigator.mediaSession.setActionHandler("pause", () => this.pause());
      navigator.mediaSession.setActionHandler("previoustrack", () =>
        this._emit("prev"),
      );
      navigator.mediaSession.setActionHandler("nexttrack", () =>
        this._emit("next"),
      );
      navigator.mediaSession.setActionHandler("seekto", (details) => {
        if (details.seekTime != null) this.seek(details.seekTime);
      });
      navigator.mediaSession.setActionHandler("seekbackward", (details) => {
        this.seek(this.currentTime - (details.seekOffset || 10));
      });
      navigator.mediaSession.setActionHandler("seekforward", (details) => {
        this.seek(this.currentTime + (details.seekOffset || 10));
      });
    }
  }

  _updateMediaSession(track) {
    if ("mediaSession" in navigator && track) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist || "Unknown Artist",
        album: track.album || "Unknown Album",
        artwork: track.cover
          ? [{ src: track.cover, sizes: "512x512", type: "image/jpeg" }]
          : [],
      });
      if (track.isYouTube && track.description) {
      }

      this._updatePlaybackState();

      this._updateMediaPosition();
    }
  }

  _updatePlaybackState() {
    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = this.isPlaying
        ? "playing"
        : "paused";
    }
  }

  _updateMediaPosition() {
    if (
      "mediaSession" in navigator &&
      "setPositionState" in navigator.mediaSession
    ) {
      try {
        if (this.duration > 0) {
          navigator.mediaSession.setPositionState({
            duration: this.duration,
            playbackRate: this.activePlayer.playbackRate || 1,
            position: this.currentTime,
          });
        }
      } catch (e) {
        console.warn("Error updating media position:", e);
      }
    }
  }

  async play(track, preFade = false) {
    if (!track) return;
    if (!track.isYouTube && !track.src) return;

    if (preFade) {
      return;
    }

    this._clearPendingNext();

    this._currentTransitionId++;
    const transitionId = this._currentTransitionId;

    if (this.isCrossfading || this._changingTrack) {
      console.warn(
        "Manual play requested during active transition. Hard reset of players.",
      );
      this.isCrossfading = false;
      this._changingTrack = false;
      this.activePlayer.pause();
      this.nextPlayer.pause();
      this.activePlayer.src = "";
      this.nextPlayer.src = "";
    }

    this.currentTrack = track;
    this.nextTrack = null;
    this._transitionedFrom = null;

    this.currentTime = 0;
    this.duration = 0;

    this._updateMediaSession(track);
    this._updateNativeNotification(track, true);
    this._emit("trackchange", { track });
    this._changingTrack = true;

    setTimeout(() => {
      if (this._currentTransitionId === transitionId && this._changingTrack) {
        console.warn("Track change state took too long. Forcing reset flag.");
        this._changingTrack = false;
      }
    }, 3000);

    this.activePlayer.pause();
    this.activePlayer.src = track.src;
    this.activePlayer.volume = this.volume;

    setTimeout(() => {
      if (this._currentTransitionId !== transitionId) {
        this._changingTrack = false;
        return;
      }

      this.activePlayer
        .play()
        .then(() => {
          if (this._currentTransitionId !== transitionId) return;
          this._changingTrack = false;
          if (track.cover) {
            import("./utils.js").then(
              async ({ getDominantColor, rgbToHex }) => {
                if (this._currentTransitionId !== transitionId) return;
                const color = await getDominantColor(track.cover);
                if (this._currentTransitionId !== transitionId) return;
                const hex = rgbToHex(color.r, color.g, color.b);
                const npEl = document.getElementById("now-playing");
                if (npEl) {
                  npEl.style.setProperty("--np-accent", hex);
                  npEl.style.setProperty(
                    "--np-accent-glow",
                    `rgba(${color.r}, ${color.g}, ${color.b}, 0.3)`,
                  );
                }
              },
            );
          }
        })
        .catch((err) => {
          this._changingTrack = false;
          if (this._currentTransitionId !== transitionId) return;
          console.error("Play failed:", err);

          if (err.name !== "NotAllowedError" && err.name !== "AbortError") {
            this._scheduleNext(transitionId);
          }
        });
    }, 50);
  }

  preloadNext(track) {
    if (!track || !track.src) {
      this.nextTrack = null;
      return;
    }
    this.nextTrack = track;
    this.nextPlayer.src = track.src;
    this.nextPlayer.load();
  }

  async _startTransition() {
    if (!this.nextTrack || this.isCrossfading) return;
    this.isCrossfading = true;

    const transitionId = ++this._currentTransitionId;
    const fadeOutPlayer = this.activePlayer;
    const fadeInPlayer = this.nextPlayer;
    const duration = this.crossfadeDuration;

    this._transitionedFrom = fadeOutPlayer;

    this.activePlayer = fadeInPlayer;
    this.nextPlayer = fadeOutPlayer;
    this.currentTrack = this.nextTrack;
    this.nextTrack = null;

    fadeInPlayer.volume = 0;
    fadeInPlayer.currentTime = 0;

    this.currentTime = 0;
    this.duration = 0;

    this._emit("transition", { track: this.currentTrack });
    this._emit("trackchange", { track: this.currentTrack });
    this._updateMediaSession(this.currentTrack);
    this._updateNativeNotification(this.currentTrack, true);

    try {
      await fadeInPlayer.play();
      if (this._currentTransitionId !== transitionId) return;

      if (duration > 0) {
        this._volumeRamp(fadeInPlayer, 0, this.volume, duration);
        this._volumeRamp(fadeOutPlayer, this.volume, 0, duration);

        await new Promise((r) => setTimeout(r, duration * 1000));
        if (this._currentTransitionId !== transitionId) return;
      } else {
        fadeInPlayer.volume = this.volume;
      }

      fadeOutPlayer.pause();
      fadeOutPlayer.src = "";
    } catch (err) {
      console.error("Transition failed, attempting recovery:", err);
      if (this._currentTransitionId === transitionId) {
        // Hard reset to ensure playback doesn't stop
        this.play(this.currentTrack);
      }
    } finally {
      if (this._currentTransitionId === transitionId) {
        this.isCrossfading = false;
      }
    }
  }

  async _volumeRamp(player, start, end, duration) {
    const steps = 40;
    const interval = (duration * 1000) / steps;
    const volStep = (end - start) / steps;
    let currentVol = start;

    for (let i = 0; i < steps; i++) {
      if (player.src === "") break;
      currentVol += volStep;
      player.volume = Math.max(0, Math.min(1, currentVol));
      await new Promise((r) => setTimeout(r, interval));
    }
    player.volume = end;
  }

  pause() {
    this.isPlaying = false;
    this.activePlayer.pause();
    if (this.isCrossfading) {
      this.nextPlayer.pause();
    }

    this._emit("pause", { track: this.currentTrack });
    this._updatePlaybackState();
    this._updateNativePlaybackState(false);
  }

  resume() {
    if (this.currentTrack) {
      this.activePlayer.play().catch(() => {});
      if ("mediaSession" in navigator)
        navigator.mediaSession.playbackState = "playing";
      this._updateNativePlaybackState(true);
    }
  }

  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.resume();
    }
  }

  seek(time) {
    if (isFinite(time)) {
      this.activePlayer.currentTime = Math.max(
        0,
        Math.min(time, this.duration),
      );
    }
  }

  setVolume(level) {
    this.volume = Math.max(0, Math.min(1, level));
    if (!this.isCrossfading) {
      this.activePlayer.volume = this.volume;
    }
    this._emit("volumechange", { volume: this.volume });
  }

  setCrossfade(seconds) {
    this.crossfadeDuration = Math.max(0, Math.min(12, seconds));
    localStorage.setItem("flow_crossfade", this.crossfadeDuration.toString());
  }

  startSleepTimer(minutes) {
    this.stopSleepTimer();

    if (minutes <= 0) return;

    this.sleepTimerEndTime = Date.now() + minutes * 60 * 1000;
    this.sleepTimerRemaining = minutes * 60 * 1000;
    this._emit("sleeptimer", { remaining: this.sleepTimerRemaining });

    this._sleepInterval = setInterval(() => {
      const remaining = Math.max(0, this.sleepTimerEndTime - Date.now());
      this.sleepTimerRemaining = remaining;
      this._emit("sleeptimer", { remaining });

      if (remaining <= 0) {
        this.stopSleepTimer();
        this.pause();
        store.showToast("Sleep timer finished. Goodnight! 💤");
      }
    }, 1000);
  }

  stopSleepTimer() {
    if (this._sleepInterval) {
      clearInterval(this._sleepInterval);
      this._sleepInterval = null;
    }
    this.sleepTimerRemaining = 0;
    this.sleepTimerEndTime = 0;
    this._emit("sleeptimer", { remaining: 0 });
  }

  toggleRepeat() {
    // Modes: 1. off + stopAfterCurrent = Play Once, 2. off + !stopAfterCurrent = Play to End, 3. all = Repeat All, 4. one = Repeat One

    if (this.repeatMode === "off" && this.stopAfterCurrent) {
      this.repeatMode = "off";
      this.stopAfterCurrent = false;
    } else if (this.repeatMode === "off" && !this.stopAfterCurrent) {
      this.repeatMode = "all";
      this.stopAfterCurrent = false;
    } else if (this.repeatMode === "all") {
      this.repeatMode = "one";
      this.stopAfterCurrent = false;
    } else {
      this.repeatMode = "off";
      this.stopAfterCurrent = true;
    }

    if (this.repeatMode !== "off" || this.stopAfterCurrent) {
      this.shuffleMode = false;
      this._emit("shufflechange", { enabled: false });
    }

    this._emit("repeatchange", {
      mode: this.repeatMode,
      stopAfterCurrent: this.stopAfterCurrent,
    });
    return this.repeatMode;
  }

  toggleShuffle() {
    this.shuffleMode = !this.shuffleMode;

    if (this.shuffleMode) {
      this.repeatMode = "off";
      this.stopAfterCurrent = false;
      this._emit("repeatchange", { mode: "off", stopAfterCurrent: false });
    }

    this._emit("shufflechange", { enabled: this.shuffleMode });
    return this.shuffleMode;
  }

  toggleStopAfterCurrent() {
    this.stopAfterCurrent = !this.stopAfterCurrent;
    this._emit("stopaftercurrentchange", { enabled: this.stopAfterCurrent });
    return this.stopAfterCurrent;
  }

  setPauseOnDisconnect(enabled) {
    this.pauseOnDisconnect = enabled;
    localStorage.setItem("flow_pause_disconnect", enabled.toString());
  }

  setPlayOnConnect(enabled) {
    this.playOnConnect = enabled;
    localStorage.setItem("flow_play_connect", enabled.toString());
  }

  setAvoidShortTracks(enabled) {
    this.avoidShortTracks = enabled;
    localStorage.setItem("flow_avoid_short", enabled.toString());
    this._emit("library_filter_change");
  }

  setMinTrackDuration(seconds) {
    this.minTrackDuration = seconds;
    localStorage.setItem("flow_min_duration", seconds.toString());
    this._emit("library_filter_change");
  }

  setAccentColor(color) {
    this.accentColor = color;
    localStorage.setItem("flow_accent_color", color);

    document.documentElement.style.setProperty("--accent", color);
    document.documentElement.style.setProperty("--accent-hover", color);

    const hexToRgb = (hex) => {
      var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result
        ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
        : "29, 185, 84";
    };
    document.documentElement.style.setProperty("--accent-rgb", hexToRgb(color));

    this._emit("accentchange", { color });
  }

  _handleTrackEnd() {
    this._clearPendingNext();
    if (this.repeatMode === "one") {
      this.activePlayer.currentTime = 0;
      this.activePlayer.play().catch(() => {});
    } else {
      this._emit("ended");
    }
  }

  _updateNativeNotification(track, isPlaying) {
    if (!NowPlaying || !track) return;
    NowPlaying.updateNotification({
      title: track.title || "Flow",
      artist: track.artist || "Unknown Artist",
      album: track.album || "Unknown Album",
      coverUri: track.rawCover || track.cover || "",
      trackUri: track.rawContentUri || "",
      isPlaying: isPlaying,
      duration: track.duration || 0,
    }).catch((e) => console.warn("Native notification update failed:", e));

    this._startPositionUpdates();
  }

  _updateNativePlaybackState(isPlaying) {
    if (!NowPlaying) return;
    NowPlaying.updatePlaybackState({ isPlaying }).catch(() => {});
    if (isPlaying) {
      this._startPositionUpdates();
    } else {
      this._stopPositionUpdates();
    }
  }

  _startPositionUpdates() {
    if (!NowPlaying) return;
    this._stopPositionUpdates();
    this._positionInterval = setInterval(() => {
      if (this.isPlaying && this.currentTime > 0) {
        NowPlaying.updatePosition({
          position: this.currentTime,
          duration: this.duration,
        }).catch(() => {});
      }
    }, 5000);
  }

  _stopPositionUpdates() {
    if (this._positionInterval) {
      clearInterval(this._positionInterval);
      this._positionInterval = null;
    }
  }

  _setupNativeListener() {
    if (!NowPlaying) return;
    NowPlaying.addListener("mediaAction", (data) => {
      const action = data.action || "";

      if (action === "play") {
        this.resume();
      } else if (action === "pause") {
        this.pause();
      } else if (action === "next") {
        this._emit("next");
      } else if (action === "prev") {
        this._emit("prev");
      } else if (action.startsWith("seekTo:")) {
        const posMs = parseInt(action.split(":")[1], 10);
        if (!isNaN(posMs)) {
          this.seek(posMs / 1000);
        }
      }
      if (action === "headsetDisconnected") {
        if (this.pauseOnDisconnect) {
          this.pause();
          store.showToast("Headphones disconnected 🎧");
        }
      } else if (action === "headsetConnected") {
        if (this.playOnConnect && this.currentTrack) {
          this.resume();
          store.showToast("Headphones connected! 🎵");
        }
      }
    });
  }

  on(event, callback) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(callback);
  }

  off(event, callback) {
    if (!this._listeners[event]) return;
    this._listeners[event] = this._listeners[event].filter(
      (cb) => cb !== callback,
    );
  }

  _emit(event, data) {
    if (this._listeners[event]) {
      this._listeners[event].forEach((cb) => cb(data));
    }
  }
}

export const audioEngine = new AudioEngine();
