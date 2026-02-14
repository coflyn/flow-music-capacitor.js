import tracksData from "../data/tracks.json";
import { scanner } from "./scanner.js";
import { audioEngine } from "./audioEngine.js";

class Library {
  constructor() {
    this.tracks = tracksData.tracks || [];
    this.albums = tracksData.albums || [];
    this.artists = tracksData.artists || [];
    this._favorites = this._loadFavorites();
    this._playlists = this._loadPlaylists();
    this._recentlyPlayed = this._loadRecent();
    this._playCounts = this._loadPlayCounts();
    this._playCounts = this._loadPlayCounts();
    this._scannedFolders = this._loadScannedFolders();
    this.autoScan = localStorage.getItem("flow_autoscan") !== "false";
    this._listeners = {};
    this._initialized = false;
  }

  _saveToLocal() {
    localStorage.setItem(
      "zplayer_tracks_modified",
      JSON.stringify(this.tracks),
    );
  }

  /**
   * Initialize by loading cached library first, then scanning if needed.
   * Should be called once at app startup.
   */
  async init() {
    if (this._initialized) return;
    this._initialized = true;

    // Try to load from cache first (instant startup)
    const cached = this._loadCachedLibrary();
    if (cached && cached.tracks && cached.tracks.length > 0) {
      this.tracks = cached.tracks;
      this.albums = cached.albums || [];
      this.artists = cached.artists || [];
      this._enrichAlbums();
      this._enrichArtists();
      this._emit("updated", {
        tracks: this.tracks.length,
        albums: this.albums.length,
        artists: this.artists.length,
      });

      if (this.autoScan) {
        this.rescan().catch(() => {});
      }
      return; // Use cached data, no re-scan needed
    }

    // No cache: perform a full scan
    try {
      const result = await scanner.scan();
      let allTracks = result.tracks || [];
      let allAlbums = result.albums || [];
      let allArtists = result.artists || [];

      // Scan custom folders
      for (const folder of this._scannedFolders) {
        try {
          const folderResult = await scanner.scanFolder(folder.uri);
          if (folderResult) {
            this._mergeResults(folderResult, allTracks, allAlbums, allArtists);
          }
        } catch (e) {
          console.warn(`Scan failed for folder ${folder.name}:`, e);
        }
      }

      if (allTracks.length > 0) {
        this.tracks = allTracks;
        this.albums = allAlbums;
        this.artists = allArtists;
        this._enrichAlbums();
        this._enrichArtists();
        this._saveCachedLibrary(); // Logic consolidated inside
        this._emit("updated", {
          tracks: this.tracks.length,
          albums: this.albums.length,
          artists: this.artists.length,
        });
      }
    } catch (err) {
      console.warn("Library init scan failed, using demo data:", err);
    }
  }

  _enrichAlbums() {
    // Build trackIds for albums if not present
    this.albums.forEach((album) => {
      if (!album.trackIds || album.trackIds.length === 0) {
        album.trackIds = this.tracks
          .filter((t) => t.albumId === album.id)
          .map((t) => t.id);
      }
    });
    // Build artistId for albums if missing
    this.albums.forEach((album) => {
      if (!album.artistId) {
        const firstTrack = this.tracks.find((t) => t.albumId === album.id);
        if (firstTrack) album.artistId = firstTrack.artistId;
      }
    });
  }

  _enrichArtists() {
    this.artists.forEach((artist) => {
      artist.numTracks = this.tracks.filter(
        (t) => t.artistId === artist.id,
      ).length;
    });
  }

  _saveCachedLibrary() {
    try {
      localStorage.setItem(
        "flow_library_cache",
        JSON.stringify({
          tracks: this.tracks,
          albums: this.albums,
          artists: this.artists,
          savedAt: Date.now(),
        }),
      );
    } catch {
      /* storage full */
    }
  }

  _loadCachedLibrary() {
    try {
      const data = localStorage.getItem("flow_library_cache");
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  /**
   * Let user pick a folder and scan it
   */
  async pickAndScanFolder() {
    try {
      const folder = await scanner.chooseFolder();
      if (!folder) return;

      const path = folder.folderUri;

      // Check for overlaps (subfolders or parent folders)
      const existing = this._scannedFolders.find(
        (f) => path.startsWith(f.uri) || f.uri.startsWith(path),
      );
      if (existing) {
        if (existing.uri === path) {
          this._emit("toast", { message: "Folder already added" });
        } else {
          this._emit("toast", {
            message: "Folder overlaps with an existing one",
          });
        }
        return;
      }

      this._scannedFolders.push({
        uri: path,
        name: folder.folderName || "Unknown Folder",
      });
      this._saveScannedFolders();

      const result = await scanner.scanFolder(path);
      if (result) {
        this._mergeResults(result);

        this._enrichAlbums();
        this._enrichArtists();
        this._saveCachedLibrary();

        this._emit("updated", {
          tracks: this.tracks.length,
          albums: this.albums.length,
          artists: this.artists.length,
        });

        this._emit("toast", {
          message: `Added ${result.tracks?.length || 0} songs`,
        });
      }
    } catch (err) {
      console.error("Pick and scan failed:", err);
    }
  }

  getScannedFolders() {
    return this._scannedFolders;
  }

  removeScannedFolder(uri) {
    this._scannedFolders = this._scannedFolders.filter((f) => f.uri !== uri);
    this._saveScannedFolders();
    this._emit("updated");
  }

  _loadScannedFolders() {
    try {
      return JSON.parse(localStorage.getItem("flow_scanned_folders")) || [];
    } catch {
      return [];
    }
  }

  _saveScannedFolders() {
    localStorage.setItem(
      "flow_scanned_folders",
      JSON.stringify(this._scannedFolders),
    );
  }

  /**
   * Centralized merging logic to ensure tracks, albums, and artists are synced.
   */
  _mergeResults(
    result,
    targetTracks = this.tracks,
    targetAlbums = this.albums,
    targetArtists = this.artists,
  ) {
    if (!result) return;

    // Merge tracks
    if (result.tracks) {
      result.tracks.forEach((t) => {
        if (!targetTracks.find((ex) => ex.id === t.id)) {
          targetTracks.push(t);
        }
      });
    }

    // Merge albums
    if (result.albums) {
      result.albums.forEach((a) => {
        if (!targetAlbums.find((ex) => ex.id === a.id)) {
          targetAlbums.push(a);
        }
      });
    }

    // Merge artists
    if (result.artists) {
      result.artists.forEach((ar) => {
        if (!targetArtists.find((ex) => ex.id === ar.id)) {
          targetArtists.push(ar);
        }
      });
    }
  }

  /**
   * Force rescan music from device with cache clear
   */
  async rescan() {
    localStorage.removeItem("flow_library_cache");
    localStorage.removeItem("zplayer_scan_cache");
    this._initialized = false;
    return this.init();
  }

  setAutoScan(enabled) {
    this.autoScan = enabled;
    localStorage.setItem("flow_autoscan", enabled.toString());
  }

  clearMetadataCache() {
    // Keep tracks but clear albums/artists to force rebuild?
    // Or just a full rescan. Let's provide a clear toast feedback.
    localStorage.removeItem("flow_library_cache");
    localStorage.removeItem("zplayer_scan_cache");
    this._emit("toast", { message: "Metadata cache cleared." });
  }

  getAllTracks() {
    return this._filterTracks(this.tracks);
  }

  _filterTracks(tracks) {
    if (!audioEngine.avoidShortTracks) return tracks;
    return tracks.filter(
      (t) => (t.duration || 0) >= audioEngine.minTrackDuration,
    );
  }

  getTrackById(id) {
    return this.tracks.find((t) => t.id === id);
  }

  getTracksByAlbum(albumId) {
    return this.tracks.filter((t) => t.albumId === albumId);
  }

  getTracksByArtist(artistId) {
    return this.tracks.filter((t) => t.artistId === artistId);
  }

  /**
   * Add a track from an external source (like YouTube search results)
   */
  addExternalTrack(track) {
    if (!this.tracks.find((t) => t.id === track.id)) {
      // Ensure it has basic fields
      const newTrack = {
        ...track,
        id: track.id || `ext_${Date.now()}`,
        dateAdded: Date.now(),
        artistId: track.artistId || "yt_unknown",
        albumId: track.albumId || "yt_downloads",
      };

      this.tracks.push(newTrack);

      // Ensure "YouTube" artist/album exist in memory
      if (!this.artists.find((a) => a.id === newTrack.artistId)) {
        this.artists.push({
          id: newTrack.artistId,
          name: newTrack.artist,
          genre: "YouTube",
        });
      }
      if (!this.albums.find((a) => a.id === newTrack.albumId)) {
        this.albums.push({
          id: newTrack.albumId,
          title: "YouTube Downloads",
          artist: "Various Artists",
          cover: "",
        });
      }

      this._saveToLocal();
      this._enrichArtists();
      this._emit("updated");
      return newTrack;
    }
    return this.tracks.find((t) => t.id === track.id);
  }

  /**
   * Sort tracks by various criteria
   */
  sortTracks(tracks, criterion = "title", ascending = true) {
    const sorted = [...tracks].sort((a, b) => {
      let valA, valB;

      switch (criterion) {
        case "artist":
          valA = (a.artist || "").toLowerCase();
          valB = (b.artist || "").toLowerCase();
          break;
        case "album":
          valA = (a.album || "").toLowerCase();
          valB = (b.album || "").toLowerCase();
          break;
        case "duration":
          valA = a.duration || 0;
          valB = b.duration || 0;
          break;
        case "date":
          valA = a.createdAt || 0;
          valB = b.createdAt || 0;
          break;
        default:
          valA = (a.title || "").toLowerCase();
          valB = (b.title || "").toLowerCase();
      }

      if (valA < valB) return ascending ? -1 : 1;
      if (valA > valB) return ascending ? 1 : -1;
      return 0;
    });
    return sorted;
  }

  getAllAlbums() {
    return this.albums;
  }

  getAlbumById(id) {
    return this.albums.find((a) => a.id === id);
  }

  getAlbumsByArtist(artistId) {
    return this.albums.filter((a) => a.artistId === artistId);
  }

  getAllArtists() {
    return this.artists;
  }

  getArtistById(id) {
    return this.artists.find((a) => a.id === id);
  }

  search(query) {
    if (!query || query.trim().length === 0)
      return { tracks: [], albums: [], artists: [] };
    const q = query.toLowerCase().trim();

    const tracks = this.tracks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        t.album.toLowerCase().includes(q),
    );

    const albums = this.albums.filter(
      (a) =>
        a.title.toLowerCase().includes(q) || a.artist.toLowerCase().includes(q),
    );

    const artists = this.artists.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        (a.genre && a.genre.toLowerCase().includes(q)),
    );

    return { tracks, albums, artists };
  }

  getFavorites() {
    return this._favorites;
  }

  getFavoriteTracks() {
    return this.tracks.filter((t) => this._favorites.includes(t.id));
  }

  isFavorite(trackId) {
    return this._favorites.includes(trackId);
  }

  toggleFavorite(trackId) {
    const idx = this._favorites.indexOf(trackId);
    if (idx >= 0) {
      this._favorites.splice(idx, 1);
    } else {
      this._favorites.push(trackId);
    }
    this._saveFavorites();
    return this.isFavorite(trackId);
  }

  _loadFavorites() {
    try {
      return JSON.parse(localStorage.getItem("zplayer_favorites")) || [];
    } catch {
      return [];
    }
  }
  _saveFavorites() {
    localStorage.setItem("zplayer_favorites", JSON.stringify(this._favorites));
  }

  getPlaylists() {
    return this._playlists;
  }

  getPlaylistById(id) {
    return this._playlists.find((p) => p.id === id);
  }

  getPlaylistTracks(playlistId) {
    const pl = this.getPlaylistById(playlistId);
    if (!pl) return [];
    return pl.trackIds.map((id) => this.getTrackById(id)).filter(Boolean);
  }

  createPlaylist(name) {
    const playlist = {
      id: "pl_" + Date.now(),
      name,
      trackIds: [],
      cover: null,
      createdAt: Date.now(),
    };
    this._playlists.push(playlist);
    this._savePlaylists();
    return playlist;
  }

  deletePlaylist(id) {
    this._playlists = this._playlists.filter((p) => p.id !== id);
    this._savePlaylists();
  }

  renamePlaylist(id, newName) {
    const pl = this.getPlaylistById(id);
    if (pl) {
      pl.name = newName;
      this._savePlaylists();
    }
  }

  updatePlaylistCover(id, coverUrl) {
    const pl = this.getPlaylistById(id);
    if (pl) {
      pl.cover = coverUrl;
      this._savePlaylists();
      this._emit("updated");
    }
  }

  getArtistCover(artistId) {
    // Use first album cover from this artist as their image
    const album = this.albums.find((a) => a.artistId === artistId && a.cover);
    if (album) return album.cover;
    // Fallback: first track cover
    const track = this.tracks.find((t) => t.artistId === artistId && t.cover);
    return track ? track.cover : "";
  }

  addTrackToPlaylist(playlistId, trackId) {
    const pl = this.getPlaylistById(playlistId);
    if (pl && !pl.trackIds.includes(trackId)) {
      pl.trackIds.push(trackId);
      if (!pl.cover) {
        const track = this.getTrackById(trackId);
        if (track) pl.cover = track.cover;
      }
      this._savePlaylists();
      return true;
    }
    return false;
  }

  removeTrackFromPlaylist(playlistId, trackId) {
    const pl = this.getPlaylistById(playlistId);
    if (pl) {
      pl.trackIds = pl.trackIds.filter((id) => id !== trackId);
      this._savePlaylists();
    }
  }

  _loadPlaylists() {
    try {
      return JSON.parse(localStorage.getItem("zplayer_playlists")) || [];
    } catch {
      return [];
    }
  }
  _savePlaylists() {
    localStorage.setItem("zplayer_playlists", JSON.stringify(this._playlists));
  }

  getRecentlyPlayed() {
    return this._recentlyPlayed
      .map((id) => this.getTrackById(id))
      .filter(Boolean);
  }

  addToRecent(trackId) {
    this._recentlyPlayed = this._recentlyPlayed.filter((id) => id !== trackId);
    this._recentlyPlayed.unshift(trackId);
    if (this._recentlyPlayed.length > 20) {
      this._recentlyPlayed = this._recentlyPlayed.slice(0, 20);
    }
    this._saveRecent();
  }

  _loadRecent() {
    try {
      return JSON.parse(localStorage.getItem("zplayer_recent")) || [];
    } catch {
      return [];
    }
  }

  _loadPlayCounts() {
    try {
      return JSON.parse(localStorage.getItem("zplayer_playcounts")) || {};
    } catch {
      return {};
    }
  }

  getRecentlyAdded(limit = 20) {
    return [...this.tracks]
      .sort(
        (a, b) =>
          (b.dateAdded || b.createdAt || 0) - (a.dateAdded || a.createdAt || 0),
      )
      .slice(0, limit);
  }

  getForgottenTracks(limit = 20) {
    const counts = this._loadPlayCounts();
    // Prioritize tracks with 0 plays, then tracks with fewest plays
    return [...this.tracks]
      .map((t) => ({ ...t, plays: counts[t.id] || 0 }))
      .sort((a, b) => a.plays - b.plays)
      .slice(0, limit);
  }

  getRandomAlbum() {
    if (this.albums.length === 0) return null;
    const idx = Math.floor(Math.random() * this.albums.length);
    return this.albums[idx];
  }

  getMostPlayed(limit = 20) {
    const counts = this._loadPlayCounts();
    return [...this.tracks]
      .map((t) => ({ ...t, plays: counts[t.id] || 0 }))
      .filter((t) => t.plays > 0)
      .sort((a, b) => b.plays - a.plays)
      .slice(0, limit);
  }

  incrementPlayCount(trackId) {
    const counts = this._loadPlayCounts();
    counts[trackId] = (counts[trackId] || 0) + 1;
    localStorage.setItem("zplayer_playcounts", JSON.stringify(counts));
    this._emit("updated");
  }

  updateTrackMetadata(trackId, newData) {
    const trackIndex = this.tracks.findIndex((t) => t.id === trackId);
    if (trackIndex >= 0) {
      this.tracks[trackIndex] = { ...this.tracks[trackIndex], ...newData };
      this._saveToLocal();
      this._emit("updated");
      return true;
    }
    return false;
  }
  _saveRecent() {
    localStorage.setItem(
      "zplayer_recent",
      JSON.stringify(this._recentlyPlayed),
    );
  }

  on(event, cb) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(cb);
  }
  off(event, cb) {
    if (!this._listeners[event]) return;
    this._listeners[event] = this._listeners[event].filter((fn) => fn !== cb);
  }
  _emit(event, data) {
    if (this._listeners[event]) {
      this._listeners[event].forEach((cb) => cb(data));
    }
  }
}

export const musicLibrary = new Library();
