import { Filesystem, Directory } from "@capacitor/filesystem";
import { Capacitor } from "@capacitor/core";

export class LRCHandler {
  constructor() {
    this.cache = new Map();
  }

  /**
   * Parse LRC content string into an array of lyric objects
   * @param {string} lrcContent - Raw LRC file content
   * @returns {Array<{time: number, text: string}>} Array of timed lyric objects
   */
  parse(lrcContent) {
    if (!lrcContent) return [];

    const lines = lrcContent.split("\n");
    const lyrics = [];
    const timeRegex = /\[(\d{2}):(\d{2})(?:[.:](\d{2,3}))?\]/g;

    for (const line of lines) {
      if (/^\[(ar|ti|al|au|length|by|offset|re|ve|id|la):/i.test(line))
        continue;

      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      let match;
      const timestamps = [];

      timeRegex.lastIndex = 0;

      while ((match = timeRegex.exec(line)) !== null) {
        const minutes = parseInt(match[1], 10);
        const seconds = parseInt(match[2], 10);
        const milliseconds = match[3]
          ? parseInt(match[3].padEnd(3, "0").slice(0, 3), 10)
          : 0;

        const totalSeconds = minutes * 60 + seconds + milliseconds / 1000;
        timestamps.push(totalSeconds);
      }

      let textPart = line.replace(timeRegex, "").trim();
      if (!textPart) {
        textPart = "•••";
      }

      for (const time of timestamps) {
        lyrics.push({ time, text: textPart });
      }
    }

    lyrics.sort((a, b) => a.time - b.time);

    if (lyrics.length > 0 && lyrics[0].time > 3) {
      lyrics.unshift({ time: 0, text: "♪" });
    }

    return lyrics;
  }

  /**
   * Fetch and parse an LRC file
   * @param {string} url - URL to the .lrc file
   * @returns {Promise<Array|null>}
   */
  async fetch(url) {
    if (this.cache.has(url)) return this.cache.get(url);

    try {
      const response = await fetch(url);
      if (!response.ok) return null;

      const content = await response.text();
      const lyrics = this.parse(content);

      if (lyrics.length > 0) {
        this.cache.set(url, lyrics);
        return lyrics;
      }
      return null;
    } catch (error) {
      console.error("LRCHandler error:", error);
      return null;
    }
  }

  /**
   * Read LRC from local device storage
   * @param {string} path - Absolute path or filename if directory is provided
   * @param {string} [directory] - Capacitor Directory (e.g. Directory.Data)
   * @returns {Promise<Array|null>}
   */
  fetchFromDevice(path, directory = null) {
    if (!path) return null;
    const cacheKey = directory ? `${directory}:${path}` : path;
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);

    return Filesystem.readFile({ path, directory: directory || undefined })
      .then((result) => {
        const lyrics = this.parse(result.data);
        if (lyrics.length > 0) {
          this.cache.set(cacheKey, lyrics);
          return lyrics;
        }
        return null;
      })
      .catch((err) => {
        if (!directory) console.warn("Local LRC read failed:", path, err);
        return null;
      });
  }
}

export const lrcHandler = new LRCHandler();
