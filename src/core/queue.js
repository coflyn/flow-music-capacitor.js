import { audioEngine } from "./audioEngine.js";

class QueueManager {
  constructor() {
    this.queue = [];
    this.originalQueue = [];
    this.currentIndex = -1;
    this.history = [];
    this._listeners = {};

    audioEngine.on("ended", () => this.playNext());
    audioEngine.on("next", () => this.playNext());
    audioEngine.on("prev", () => this.playPrev());
    audioEngine.on("transition", () => {
      const nextTrack = this.getCurrentTrack();
      console.log(
        `Transitioning to: ${nextTrack ? nextTrack.title : "unknown"} (Index: ${this.currentIndex})`,
      );
      if (this.currentIndex < this.queue.length - 1) {
        this.currentIndex++;
      } else if (audioEngine.repeatMode === "all") {
        this.currentIndex = 0;
      }

      this._syncPreload();
      this._emit("trackchange", {
        track: this.getCurrentTrack(),
        index: this.currentIndex,
      });
    });
  }

  playAll(tracks, startIndex = 0) {
    this.originalQueue = [...tracks];
    this.queue = audioEngine.shuffleMode
      ? this._shuffle([...tracks], startIndex)
      : [...tracks];
    this.currentIndex = audioEngine.shuffleMode ? 0 : startIndex;
    this._playCurrentTrack();
  }

  playTrack(track) {
    const idx = this.queue.findIndex((t) => t.id === track.id);
    if (idx >= 0) {
      this.currentIndex = idx;
    } else {
      this.queue.push(track);
      this.currentIndex = this.queue.length - 1;
    }
    this._playCurrentTrack();
  }

  addToQueue(track) {
    this.queue.push(track);
    this.originalQueue.push(track);
    this._emit("queuechange");
  }

  insertNext(track) {
    const current = this.getCurrentTrack();
    if (current && current.id === track.id) return;

    const existingIdx = this.queue.findIndex((t) => t.id === track.id);
    if (existingIdx >= 0) {
      this.queue.splice(existingIdx, 1);
      if (existingIdx < this.currentIndex) {
        this.currentIndex--;
      }
    }

    this.queue.splice(this.currentIndex + 1, 0, track);
    this._emit("queuechange");
    this._syncPreload();
  }

  reorderQueue(fromIndex, toIndex) {
    if (fromIndex < 0 || fromIndex >= this.queue.length) return;
    if (toIndex < 0 || toIndex >= this.queue.length) return;

    const [movedItem] = this.queue.splice(fromIndex, 1);
    this.queue.splice(toIndex, 0, movedItem);

    if (this.currentIndex === fromIndex) {
      this.currentIndex = toIndex;
    } else {
      if (fromIndex < this.currentIndex && toIndex >= this.currentIndex) {
        this.currentIndex--;
      } else if (
        fromIndex > this.currentIndex &&
        toIndex <= this.currentIndex
      ) {
        this.currentIndex++;
      }
    }

    this._emit("queuechange");
    this._syncPreload();
  }

  removeFromQueue(index) {
    if (index < 0 || index >= this.queue.length) return;
    if (index < this.currentIndex) {
      this.currentIndex--;
    } else if (index === this.currentIndex) {
    }
    this.queue.splice(index, 1);
    this._emit("queuechange");
  }

  clearQueue() {
    const current = this.getCurrentTrack();
    this.queue = current ? [current] : [];
    this.currentIndex = current ? 0 : -1;
    this._emit("queuechange");
  }

  clearUpcoming() {
    if (this.currentIndex >= 0) {
      this.queue = this.queue.slice(0, this.currentIndex + 1);
    }
    this._emit("queuechange");
  }

  playNext() {
    if (this.queue.length === 0) return;

    const currentTrack = this.getCurrentTrack();
    if (currentTrack) {
      this.history.push(currentTrack);
    }

    if (audioEngine.stopAfterCurrent) {
      audioEngine.stopAfterCurrent = false;
      audioEngine.pause();
      return;
    }

    if (this.currentIndex < this.queue.length - 1) {
      this.currentIndex++;
      this._playCurrentTrack();
    } else if (audioEngine.repeatMode === "all") {
      this.currentIndex = 0;
      if (audioEngine.shuffleMode) {
        this.queue = this._shuffle([...this.originalQueue]);
      }
      this._playCurrentTrack();
    } else {
      audioEngine.pause();
      this._emit("queueend");
    }
  }

  playPrev() {
    if (audioEngine.currentTime > 3) {
      audioEngine.seek(0);
      return;
    }

    if (this.currentIndex > 0) {
      this.currentIndex--;
      this._playCurrentTrack();
    } else if (audioEngine.repeatMode === "all") {
      this.currentIndex = this.queue.length - 1;
      this._playCurrentTrack();
    } else {
      audioEngine.seek(0);
    }
  }

  getCurrentTrack() {
    return this.queue[this.currentIndex] || null;
  }

  getUpcoming() {
    return this.queue.slice(this.currentIndex + 1);
  }

  toggleShuffle() {
    const enabled = audioEngine.toggleShuffle();
    const current = this.getCurrentTrack();

    if (enabled) {
      this.queue = this._shuffle([...this.originalQueue], -1, current);
      this.currentIndex = 0;
    } else {
      this.queue = [...this.originalQueue];
      if (current) {
        this.currentIndex = this.queue.findIndex((t) => t.id === current.id);
      }
    }
    this._emit("queuechange");
  }

  _shuffle(arr, startIndex, keepFirst) {
    if (keepFirst) {
      const filtered = arr.filter((t) => t.id !== keepFirst.id);
      for (let i = filtered.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [filtered[i], filtered[j]] = [filtered[j], filtered[i]];
      }
      return [keepFirst, ...filtered];
    }

    const result = [...arr];
    if (startIndex >= 0 && startIndex < result.length) {
      const [first] = result.splice(startIndex, 1);
      for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
      }
      return [first, ...result];
    }

    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  _playCurrentTrack() {
    const track = this.getCurrentTrack();
    if (track) {
      audioEngine.play(track);
      this._syncPreload();
      this._emit("trackchange", { track, index: this.currentIndex });
    }
  }

  _syncPreload() {
    const nextIndex = this.currentIndex + 1;
    if (nextIndex < this.queue.length) {
      audioEngine.preloadNext(this.queue[nextIndex]);
    } else if (audioEngine.repeatMode === "all" && this.queue.length > 0) {
      audioEngine.preloadNext(this.queue[0]);
    } else {
      audioEngine.preloadNext(null);
    }
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

export const queueManager = new QueueManager();
