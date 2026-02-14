import { Capacitor, registerPlugin } from "@capacitor/core";
import tracksData from "../data/tracks.json";

const MusicScanner = registerPlugin("MusicScanner");

/**
 * Convert native file paths and content:// URIs to WebView-accessible URLs.
 * ALL non-http URIs must go through Capacitor.convertFileSrc() which converts:
 *   - content://... → http://localhost/_capacitor_content_/...
 *   - file://...    → http://localhost/_capacitor_file_/...
 * Without this conversion, <audio> and <img> elements CANNOT load native URIs.
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

  /**
   * Check if running on a native platform
   */
  isNative() {
    return Capacitor.isNativePlatform();
  }

  /**
   * Request audio permission on Android
   */
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

  /**
   * Check current permission status
   */
  async checkPermission() {
    if (!this.isNative()) return { audio: "granted" };
    try {
      const result = await MusicScanner.checkPermissions();
      return result;
    } catch {
      return { audio: "denied" };
    }
  }

  /**
   * Let user choose a folder to scan
   */
  async chooseFolder() {
    if (!this.isNative()) return null;
    try {
      return await MusicScanner.chooseFolder();
    } catch (err) {
      console.error("Choose folder failed:", err);
      return null;
    }
  }

  /**
   * Scan a specific folder
   */
  async scanFolder(folderUri) {
    if (!this.isNative()) return this._getDemoData();

    this._isScanning = true;
    this._emit("scanstart");

    try {
      const result = await MusicScanner.scanFolder({ folderUri });
      const processed = this._processNativeResult(result);

      // Merge with existing or replace?
      // For "scan folder", it's usually better to just use that as the library
      // or add to it. Let's merge for now to be helpful.
      const current = this.getCached();
      const mergedTracks = [...current.tracks];

      processed.tracks.forEach((newTrack) => {
        if (!mergedTracks.find((t) => t.id === newTrack.id)) {
          mergedTracks.push(newTrack);
        }
      });

      // Filter or rebuild albums/artists from merged tracks
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

  /**
   * Scan for local music files
   * Returns { tracks, albums, artists } matching the app's data format
   */
  async scan() {
    if (!this.isNative()) {
      // Return demo data on web
      return this._getDemoData();
    }

    if (this._isScanning) {
      return this._cachedResult || this._getDemoData();
    }

    this._isScanning = true;
    this._emit("scanstart");

    try {
      // Request permission first
      const perm = await this.requestPermission();
      if (perm.audio !== "granted") {
        console.warn("Audio permission not granted");
        this._isScanning = false;
        this._emit("scanerror", { error: "Permission denied" });
        return this._getDemoData();
      }

      // Scan via native plugin
      const [mainResult, downloadsResult] = await Promise.all([
        MusicScanner.scanMusic(),
        MusicScanner.scanDownloads(),
      ]);

      // Merge results
      const allTracks = [...(mainResult.tracks || [])];
      (downloadsResult.tracks || []).forEach((t) => {
        if (!allTracks.find((existing) => existing.id === t.id)) {
          allTracks.push(t);
        }
      });

      // Process the result to match our data format
      const processed = this._processNativeResult({
        tracks: allTracks,
        albums: mainResult.albums || [],
        artists: mainResult.artists || [],
      });
      this._cachedResult = processed;

      // Cache in localStorage
      try {
        localStorage.setItem("zplayer_scan_cache", JSON.stringify(processed));
        localStorage.setItem("zplayer_scan_time", Date.now().toString());
      } catch {
        /* storage full */
      }

      this._isScanning = false;
      this._emit("scancomplete", { count: processed.tracks.length });
      return processed;
    } catch (err) {
      console.error("Music scan failed:", err);
      this._isScanning = false;
      this._emit("scanerror", { error: err.message });

      // Try to return cached data
      return this._getCachedData() || this._getDemoData();
    }
  }

  /**
   * Specifically scan the system Downloads folder
   */
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

  /**
   * Get cached scan result (no network call)
   */
  getCached() {
    if (this._cachedResult) return this._cachedResult;
    return this._getCachedData() || this._getDemoData();
  }

  /**
   * Process native MediaStore result into our app format
   */
  _processNativeResult(result) {
    const tracks = result.tracks || [];
    const albums = result.albums || [];
    const artists = result.artists || [];

    // Build trackIds per album
    const albumTrackMap = {};
    const trackGeneratedAlbums = {};
    const trackGeneratedArtists = {};

    tracks.forEach((t) => {
      if (!albumTrackMap[t.albumId]) albumTrackMap[t.albumId] = [];
      albumTrackMap[t.albumId].push(t.id);

      // Synthesis: Prepare skeleton objects in case native index is missing them
      if (!trackGeneratedAlbums[t.albumId]) {
        trackGeneratedAlbums[t.albumId] = {
          id: t.albumId,
          title: t.album || "Unknown Album",
          artist: t.artist || "Unknown Artist",
          artistId: t.artistId,
          cover: t.cover, // already converted in some cases, but we'll use raw for now
        };
      }
      if (!trackGeneratedArtists[t.artistId]) {
        trackGeneratedArtists[t.artistId] = {
          id: t.artistId,
          name: t.artist || "Unknown Artist",
        };
      }
    });

    // Find artistId for each album from tracks
    const albumArtistMap = {};
    tracks.forEach((t) => {
      if (!albumArtistMap[t.albumId]) albumArtistMap[t.albumId] = t.artistId;
    });

    // Merge native albums with synthesized ones
    const finalAlbums = [...albums];
    Object.keys(trackGeneratedAlbums).forEach((id) => {
      if (!finalAlbums.find((a) => a.id === id)) {
        finalAlbums.push(trackGeneratedAlbums[id]);
      }
    });

    // Merge native artists with synthesized ones
    const finalArtists = [...artists];
    Object.keys(trackGeneratedArtists).forEach((id) => {
      if (!finalArtists.find((ar) => ar.id === id)) {
        finalArtists.push(trackGeneratedArtists[id]);
      }
    });

    // Enrich albums — convert cover URIs for WebView
    const enrichedAlbums = finalAlbums.map((a) => ({
      ...a,
      trackIds: albumTrackMap[a.id] || [],
      artistId: albumArtistMap[a.id] || a.artistId || "",
      cover: convertUri(a.cover),
      genre: a.genre || "",
    }));

    // For tracks — convert BOTH src (for playback) AND cover (for display)
    // IMPORTANT: Prefer contentUri over src (file path) because Android 11+
    // blocks raw file path access from WebView via scoped storage
    const enrichedTracks = tracks.map((t) => ({
      ...t,
      src: convertUri(t.contentUri || t.src || ""),
      rawCover: t.cover || "", // Original URI for native notification album art
      rawContentUri: t.contentUri || "", // Original content URI for native metadata retriever
      cover: convertUri(t.cover),
    }));

    return {
      tracks: enrichedTracks,
      albums: enrichedAlbums,
      artists: finalArtists,
    };
  }

  /**
   * Get cached data from localStorage
   */
  _getCachedData() {
    try {
      const cached = localStorage.getItem("zplayer_scan_cache");
      if (cached) return JSON.parse(cached);
    } catch {
      /* ignore */
    }
    return null;
  }

  /**
   * Return demo data for web development
   */
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
