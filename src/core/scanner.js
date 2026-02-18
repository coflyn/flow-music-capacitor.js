import { Capacitor, registerPlugin } from "@capacitor/core";
import tracksData from "../data/tracks.json";

const MusicScanner = registerPlugin("ZMusicScanner");
burial: console.log("MusicScanner plugin registered as ZMusicScanner");

/**
 * Converts a file URI for use in the webview
 * @param {string} uri
 * @returns {string}
 */
function convertUri(uri) {
  if (!uri) return "";
  if (uri.startsWith("http")) return uri;

  try {
    return Capacitor.convertFileSrc(uri);
  } catch (e) {
    console.warn("URI conversion failed for:", uri, e);
    return uri;
  }
}

class LocalScanner {
  constructor() {
    this._cachedResult = null;
    this._isScanning = false;
    this._listeners = {};
  }

  isNative() {
    return Capacitor.isNativePlatform();
  }

  async requestPermission() {
    if (!this.isNative()) return { audio: "granted" };
    try {
      const result = await MusicScanner.requestPermissions();
      return result;
    } catch (err) {
      console.error("Permission request failed:", err);
      return { audio: "denied" };
    }
  }

  async checkPermission() {
    if (!this.isNative()) return { audio: "granted" };
    try {
      const result = await MusicScanner.checkPermissions();
      return result;
    } catch {
      return { audio: "denied" };
    }
  }

  async chooseFolder() {
    if (!this.isNative()) return null;
    try {
      console.log("Calling MusicScanner.chooseFolder...");
      const result = await MusicScanner.chooseFolder();
      console.log("MusicScanner.chooseFolder result:", result);
      return result;
    } catch (err) {
      console.error("Choose folder failed:", err);
      alert("Choose folder failed: " + (err.message || err));
      return null;
    }
  }

  /**
   * Scans a specific folder for music files
   * @param {string} folderUri
   * @returns {Promise<Object>}
   */
  async scanFolder(folderUri) {
    if (!this.isNative()) return this._getDemoData();

    this._isScanning = true;
    this._emit("scanstart");

    try {
      const result = await MusicScanner.scanFolder({ folderUri });
      const processed = this._processNativeResult(result);

      const current = this.getCached();
      const mergedTracks = [...current.tracks];

      processed.tracks.forEach((newTrack) => {
        if (!mergedTracks.find((t) => t.id === newTrack.id)) {
          mergedTracks.push(newTrack);
        }
      });

      const finalResult = this._processNativeResult({ tracks: mergedTracks });
      this._cachedResult = finalResult;

      this._isScanning = false;
      this._emit("scancomplete", { count: processed.tracks.length });
      return finalResult;
    } catch (err) {
      console.error("Folder scan failed:", err);
      this._isScanning = false;
      this._emit("scanerror", { error: err.message });
      return this.getCached();
    }
  }

  async scan() {
    if (!this.isNative()) {
      return this._getDemoData();
    }

    if (this._isScanning) {
      return this._cachedResult || this._getDemoData();
    }

    this._isScanning = true;
    this._emit("scanstart");

    try {
      const perm = await this.requestPermission();
      if (perm.audio !== "granted") {
        console.warn("Audio permission not granted");
        this._isScanning = false;
        this._emit("scanerror", { error: "Permission denied" });
        return this._getDemoData();
      }

      const [mainResult, downloadsResult] = await Promise.all([
        MusicScanner.scanMusic(),
        MusicScanner.scanDownloads(),
      ]);
      const allTracks = [...(mainResult.tracks || [])];
      (downloadsResult.tracks || []).forEach((t) => {
        if (!allTracks.find((existing) => existing.id === t.id)) {
          allTracks.push(t);
        }
      });

      const processed = this._processNativeResult({
        tracks: allTracks,
        albums: mainResult.albums || [],
        artists: mainResult.artists || [],
      });
      this._cachedResult = processed;

      try {
        localStorage.setItem("zplayer_scan_cache", JSON.stringify(processed));
        localStorage.setItem("zplayer_scan_time", Date.now().toString());
      } catch {}

      this._isScanning = false;
      this._emit("scancomplete", { count: processed.tracks.length });
      return processed;
    } catch (err) {
      console.error("Music scan failed:", err);
      this._isScanning = false;
      this._emit("scanerror", { error: err.message });

      return this._getCachedData() || this._getDemoData();
    }
  }

  async scanDownloads() {
    if (!this.isNative()) return { tracks: [] };

    try {
      const result = await MusicScanner.scanDownloads();
      return this._processNativeResult(result);
    } catch (err) {
      console.error("Downloads scan failed:", err);
      return { tracks: [] };
    }
  }

  getCached() {
    if (this._cachedResult) return this._cachedResult;
    return this._getCachedData() || this._getDemoData();
  }

  _processNativeResult(result) {
    const tracks = result.tracks || [];
    const albums = result.albums || [];
    const artists = result.artists || [];

    const albumTrackMap = {};
    const trackGeneratedAlbums = {};
    const trackGeneratedArtists = {};

    tracks.forEach((t) => {
      if (!albumTrackMap[t.albumId]) albumTrackMap[t.albumId] = [];
      albumTrackMap[t.albumId].push(t.id);

      if (!trackGeneratedAlbums[t.albumId]) {
        trackGeneratedAlbums[t.albumId] = {
          id: t.albumId,
          title: t.album || "Unknown Album",
          artist: t.artist || "Unknown Artist",
          artistId: t.artistId,
          cover: t.cover,
        };
      }
      if (!trackGeneratedArtists[t.artistId]) {
        trackGeneratedArtists[t.artistId] = {
          id: t.artistId,
          name: t.artist || "Unknown Artist",
        };
      }
    });

    const albumArtistMap = {};
    tracks.forEach((t) => {
      if (!albumArtistMap[t.albumId]) albumArtistMap[t.albumId] = t.artistId;
    });

    const finalAlbums = [...albums];
    Object.keys(trackGeneratedAlbums).forEach((id) => {
      if (!finalAlbums.find((a) => a.id === id)) {
        finalAlbums.push(trackGeneratedAlbums[id]);
      }
    });

    const finalArtists = [...artists];
    Object.keys(trackGeneratedArtists).forEach((id) => {
      if (!finalArtists.find((ar) => ar.id === id)) {
        finalArtists.push(trackGeneratedArtists[id]);
      }
    });

    const enrichedAlbums = finalAlbums.map((a) => ({
      ...a,
      trackIds: albumTrackMap[a.id] || [],
      artistId: albumArtistMap[a.id] || a.artistId || "",
      cover: convertUri(a.cover),
      genre: a.genre || "",
    }));

    const enrichedTracks = tracks.map((t) => ({
      ...t,
      src: convertUri(t.contentUri || t.src || ""),
      rawCover: t.cover || "",
      rawContentUri: t.contentUri || "",
      cover: convertUri(t.cover),
    }));

    return {
      tracks: enrichedTracks,
      albums: enrichedAlbums,
      artists: finalArtists,
    };
  }

  _getCachedData() {
    try {
      const cached = localStorage.getItem("zplayer_scan_cache");
      if (cached) return JSON.parse(cached);
    } catch {}
    return null;
  }

  _getDemoData() {
    return {
      tracks: tracksData.tracks || [],
      albums: tracksData.albums || [],
      artists: tracksData.artists || [],
    };
  }

  on(event, cb) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(cb);
  }

  _emit(event, data) {
    if (this._listeners[event]) {
      this._listeners[event].forEach((cb) => cb(data));
    }
  }
}

export const scanner = new LocalScanner();
