import { Capacitor, registerPlugin } from "@capacitor/core";
import { store } from "./store.js";

const NowPlaying = Capacitor.isNativePlatform()
  ? registerPlugin("NowPlaying")
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
    this.repeatMode = "all";
    this.shuffleMode = false;

    this.crossfadeDuration =
      parseFloat(localStorage.getItem("flow_crossfade")) || 1.5;
    this.sleepTimer = null;
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

    this.audioCtx = null;
    this.eqFilters = null;
    this.masterGain = null;
    this.volumeGain = null;
    this._eqInitialized = false;

    this._setupAudioEvents(this.audioA);
    this._setupAudioEvents(this.audioB);
    this._setupMediaSession();
    this._setupNativeListener();

    setTimeout(() => this._loadEQSettings(), 100);
  }

  _loadEQSettings() {
    const saved = localStorage.getItem("flow_eq_gains");
    if (saved) {
      try {
        const gains = JSON.parse(saved);
        if (Array.isArray(gains)) {
          gains.forEach((g, i) => this.setEQGain(i, g));
        }
      } catch (e) {}
    }
  }

  /**
   * Lazy-init Web Audio API — only called when EQ is actually changed.
   * Before this is called, audio plays through native decoder at full quality.
   */
  _ensureAudioContext() {
    if (this._eqInitialized) return;
    this._eqInitialized = true;

    try {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 48000,
      });

      this.volumeGain = this.audioCtx.createGain();
      this.volumeGain.gain.value = this.volume;

      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.value = 1.2; // Makeup gain for EQ overhead
      this.masterGain.connect(this.audioCtx.destination);
      this.volumeGain.connect(this.masterGain);

      const frequencies = [60, 230, 910, 3600, 14000];
      this.eqFilters = frequencies.map((freq) => {
        const filter = this.audioCtx.createBiquadFilter();
        filter.type = "peaking";
        filter.frequency.value = freq;
        filter.Q.value = 1;
        filter.gain.value = 0;
        return filter;
      });

      this.eqFilters.reduce((prev, next) => {
        prev.connect(next);
        return next;
      });
      this.eqFilters[this.eqFilters.length - 1].connect(this.volumeGain);

      this.sourceA = this.audioCtx.createMediaElementSource(this.audioA);
      this.sourceB = this.audioCtx.createMediaElementSource(this.audioB);
      this.sourceA.connect(this.eqFilters[0]);
      this.sourceB.connect(this.eqFilters[0]);

      if (this.audioCtx.state === "suspended") {
        this.audioCtx.resume().catch(() => {});
      }

      console.log(
        "Web Audio EQ initialized at",
        this.audioCtx.sampleRate,
        "Hz",
      );
    } catch (e) {
      console.warn("Web Audio API not supported:", e);
      this._eqInitialized = false;
    }
  }

  setEQGain(index, gain) {
    this._ensureAudioContext();
    if (this.eqFilters && this.eqFilters[index]) {
      this.eqFilters[index].gain.setTargetAtTime(
        gain,
        this.audioCtx.currentTime,
        0.05,
      );
      const gains = this.getEQGains();
      localStorage.setItem("flow_eq_gains", JSON.stringify(gains));
    }
  }

  getEQGains() {
    return this.eqFilters
      ? this.eqFilters.map((f) => f.gain.value)
      : [0, 0, 0, 0, 0];
  }

  _setupAudioEvents(player) {
    // Resume AudioContext on user interaction or visibility change to prevent "dead" audio
    const resumeCtx = () => {
      if (this.audioCtx && this.audioCtx.state === "suspended") {
        this.audioCtx.resume();
      }
    };
    document.addEventListener("click", resumeCtx);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") resumeCtx();
    });
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

      if (this.nextTrack && !this.isCrossfading && this.duration > 0) {
        const remaining = this.duration - this.currentTime;
        // Trigger precisely at the crossfade duration, or 0.1s for gapless
        const triggerPoint = Math.max(0.1, this.crossfadeDuration);
        if (remaining <= triggerPoint) {
          this._startTransition();
        }
      }
    });

    player.addEventListener("loadedmetadata", () => {
      if (player === this.activePlayer) {
        // Track ID guard: ensure we don't update from a stale metadata load
        if (this.currentTrack && player.src.includes(this.currentTrack.src)) {
          this.duration = player.duration;
          this._emit("loaded", { duration: this.duration });
        }
      }
    });

    player.addEventListener("ended", () => {
      // Ignore if: not active player, in crossfade, changing track, or already transitioned
      if (
        player !== this.activePlayer ||
        this.isCrossfading ||
        this._changingTrack ||
        this._transitionedFrom === player
      ) {
        return;
      }
      this._handleTrackEnd();
    });

    player.addEventListener("play", () => {
      if (player === this.activePlayer) {
        this.isPlaying = true;
        this.consecutiveErrorCount = 0; // Reset on successful play
        this._emit("play", { track: this.currentTrack });
        if ("mediaSession" in navigator)
          navigator.mediaSession.playbackState = "playing";
        this._updateNativePlaybackState(true);
      }
    });

    player.addEventListener("pause", () => {
      // During crossfade, we don't emit 'pause' from the listener because
      // it might be a spurious event from the fade-out player being stopped.
      // The master pause() method handles state for both.
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
      // Ignore errors during track changes (MEDIA_ERR_ABORTED from src swap)
      if (this._changingTrack) return;

      // Check for MEDIA_ERR_ABORTED specifically if possible (Code 4)
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
        // Auto-skip to next track on actual media errors, but only if still current
        this._scheduleNext(transitionId);
      }
    });
  }

  _scheduleNext(transitionId, delay = 500) {
    this._clearPendingNext();
    this._pendingNextTimeout = setTimeout(() => {
      // Abortion guard
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
    // For local tracks, we need a src. For YouTube, we'll fetch it below.
    if (!track.isYouTube && !track.src) return;

    if (preFade) {
      // Prepared by transition
      return;
    }

    this._clearPendingNext();

    // Abort any active transition
    this._currentTransitionId++;
    this.isCrossfading = false;

    this.currentTrack = track;
    this.nextTrack = null;
    this._transitionedFrom = null;

    this.currentTime = 0;
    this.duration = 0;

    // Update metadata IMMEDIATELY (before play) so UI updates even if play is slow
    this._updateMediaSession(track);
    this._updateNativeNotification(track, true);
    this._emit("trackchange", { track });

    // Guard: prevent spurious events (ended/error/pause) when changing src
    this._changingTrack = true;
    this.activePlayer.pause();
    this.activePlayer.src = track.src;
    // When Web Audio is active, we let the GainNode handle the master volume
    // but the player itself must be at 1.0 to feed the graph at full scale.
    this.activePlayer.volume = this._eqInitialized ? 1.0 : this.volume;
    // NOTE: _changingTrack stays true until play() resolves/rejects

    // Resume AudioContext if it exists and is suspended
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume().catch(() => {});
    }

    // Play — don't await to preserve user gesture context
    const transitionId = this._currentTransitionId;

    // Safety delay for Android WebView src transition
    setTimeout(() => {
      if (this._currentTransitionId !== transitionId) return;

      this.activePlayer
        .play()
        .then(() => {
          // Abortion guard
          if (this._currentTransitionId !== transitionId) return;

          this._changingTrack = false;

          // Dynamic Colors — scoped to Now Playing screen only
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
          if (this._currentTransitionId !== transitionId) return;

          this._changingTrack = false;
          console.error("Play failed:", err);
          // Only auto-skip on actual media errors, not user gesture issues
          if (err.name !== "NotAllowedError") {
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
        if (this._eqInitialized && this.audioCtx && this.masterGain) {
          this._volumeRamp(fadeInPlayer, 0, this.volume, duration);
          this._volumeRamp(fadeOutPlayer, this.volume, 0, duration);
        } else {
          this._volumeRamp(fadeInPlayer, 0, this.volume, duration);
          this._volumeRamp(fadeOutPlayer, this.volume, 0, duration);
        }

        await new Promise((r) => setTimeout(r, duration * 1000));
        if (this._currentTransitionId !== transitionId) return;
      } else {
        fadeInPlayer.volume = this.volume;
      }

      fadeOutPlayer.pause();
      fadeOutPlayer.src = "";
      this.isCrossfading = false;
    } catch (err) {
      console.error("Transition failed:", err);
      if (this._currentTransitionId === transitionId) {
        this.isCrossfading = false;
      }
    }
  }

  /**
   * Smooth volume ramping for players
   */
  async _volumeRamp(player, start, end, duration) {
    const steps = 40; // Higher resolution for smoother "feel"
    const interval = (duration * 1000) / steps;
    const volStep = (end - start) / steps;
    let currentVol = start;

    for (let i = 0; i < steps; i++) {
      if (player.src === "") break; // Aborted
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
      if (this.audioCtx && this.audioCtx.state === "suspended") {
        this.audioCtx.resume().catch(() => {});
      }
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
    if (this._eqInitialized && this.volumeGain) {
      this.volumeGain.gain.setTargetAtTime(
        this.volume,
        this.audioCtx.currentTime,
        0.02,
      );
      this.activePlayer.volume = 1.0;
    } else if (!this.isCrossfading) {
      this.activePlayer.volume = this.volume;
    }
    this._emit("volumechange", { volume: this.volume });
  }

  setCrossfade(seconds) {
    this.crossfadeDuration = Math.max(0, Math.min(12, seconds));
    localStorage.setItem("flow_crossfade", this.crossfadeDuration.toString());
  }

  setSleepTimer(minutes) {
    if (this.sleepTimer) clearTimeout(this.sleepTimer);
    if (minutes <= 0) {
      this.sleepTimer = null;
      this._emit("sleeptimer", { remaining: 0 });
      return;
    }

    const ms = minutes * 60 * 1000;
    this.sleepTimer = setTimeout(() => {
      this.pause();
      this.sleepTimer = null;
      this._emit("sleeptimer", { remaining: 0 });
      this._emit("toast", { message: "Sleep timer triggered. Goodnight! 💤" });
    }, ms);

    this._emit("sleeptimer", { remaining: minutes });
  }

  toggleRepeat() {
    const modes = ["off", "all", "one"];
    const idx = modes.indexOf(this.repeatMode);
    this.repeatMode = modes[(idx + 1) % modes.length];
    this._emit("repeatchange", { mode: this.repeatMode });
    return this.repeatMode;
  }

  toggleShuffle() {
    this.shuffleMode = !this.shuffleMode;
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
    }, 5000); // Update every 5 seconds
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
          this.seek(posMs / 1000); // Convert ms to seconds
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
