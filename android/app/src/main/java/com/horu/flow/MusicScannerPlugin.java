package com.horu.flow;

import android.Manifest;
import android.app.Activity;
import android.content.ContentResolver;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.DocumentsContract;
import android.provider.MediaStore;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import java.io.File;
import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(
    name = "MusicScanner",
    permissions = {
        @Permission(
            alias = "audio",
            strings = {
                Manifest.permission.READ_MEDIA_AUDIO,
                Manifest.permission.READ_EXTERNAL_STORAGE
            }
        )
    }
)
public class MusicScannerPlugin extends Plugin {

    @PluginMethod
    public void scanMusic(PluginCall call) {
        try {
            JSArray tracks = new JSArray();
            JSArray albums = new JSArray();
            JSArray artists = new JSArray();

            ContentResolver resolver = getContext().getContentResolver();

            // === Scan Tracks ===
            Uri audioUri = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;
            String[] trackProjection = {
                MediaStore.Audio.Media._ID,
                MediaStore.Audio.Media.TITLE,
                MediaStore.Audio.Media.ARTIST,
                MediaStore.Audio.Media.ALBUM,
                MediaStore.Audio.Media.ALBUM_ID,
                MediaStore.Audio.Media.ARTIST_ID,
                MediaStore.Audio.Media.DURATION,
                MediaStore.Audio.Media.DATA,
                MediaStore.Audio.Media.TRACK,
                MediaStore.Audio.Media.YEAR
            };

            String selection = MediaStore.Audio.Media.IS_MUSIC + " != 0";
            String sortOrder = MediaStore.Audio.Media.TITLE + " ASC";

            Cursor cursor = resolver.query(audioUri, trackProjection, selection, null, sortOrder);

            if (cursor != null) {
                while (cursor.moveToNext()) {
                    JSObject track = new JSObject();
                    long id = cursor.getLong(cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID));
                    long albumId = cursor.getLong(cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM_ID));
                    long artistId = cursor.getLong(cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST_ID));
                    long duration = cursor.getLong(cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION));
                    String title = cursor.getString(cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.TITLE));
                    String artist = cursor.getString(cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST));
                    String album = cursor.getString(cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM));
                    String data = cursor.getString(cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DATA));

                    // Build content URI for the track
                    Uri contentUri = Uri.withAppendedPath(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, String.valueOf(id));

                    // Build album art URI
                    Uri albumArtUri = Uri.parse("content://media/external/audio/albumart/" + albumId);

                    track.put("id", "t_" + id);
                    track.put("title", title != null ? title : "Unknown");
                    track.put("artist", artist != null && !artist.equals("<unknown>") ? artist : "Unknown Artist");
                    track.put("album", album != null && !album.equals("<unknown>") ? album : "Unknown Album");
                    track.put("albumId", "a_" + albumId);
                    track.put("artistId", "ar_" + artistId);
                    track.put("duration", duration / 1000); // Convert ms to seconds
                    track.put("src", data); // File path
                    track.put("contentUri", contentUri.toString());
                    track.put("cover", albumArtUri.toString());

                    tracks.put(track);
                }
                cursor.close();
            }

            // === Scan Albums ===
            Uri albumUri = MediaStore.Audio.Albums.EXTERNAL_CONTENT_URI;
            String[] albumProjection = {
                MediaStore.Audio.Albums._ID,
                MediaStore.Audio.Albums.ALBUM,
                MediaStore.Audio.Albums.ARTIST,
                MediaStore.Audio.Albums.NUMBER_OF_SONGS,
                MediaStore.Audio.Albums.FIRST_YEAR
            };

            Cursor albumCursor = resolver.query(albumUri, albumProjection, null, null,
                MediaStore.Audio.Albums.ALBUM + " ASC");

            if (albumCursor != null) {
                while (albumCursor.moveToNext()) {
                    JSObject albumObj = new JSObject();
                    long aId = albumCursor.getLong(albumCursor.getColumnIndexOrThrow(MediaStore.Audio.Albums._ID));
                    String aTitle = albumCursor.getString(albumCursor.getColumnIndexOrThrow(MediaStore.Audio.Albums.ALBUM));
                    String aArtist = albumCursor.getString(albumCursor.getColumnIndexOrThrow(MediaStore.Audio.Albums.ARTIST));
                    int numSongs = albumCursor.getInt(albumCursor.getColumnIndexOrThrow(MediaStore.Audio.Albums.NUMBER_OF_SONGS));

                    int year = 0;
                    try {
                        year = albumCursor.getInt(albumCursor.getColumnIndexOrThrow(MediaStore.Audio.Albums.FIRST_YEAR));
                    } catch (Exception ignored) {}

                    Uri albumArtUri = Uri.parse("content://media/external/audio/albumart/" + aId);

                    albumObj.put("id", "a_" + aId);
                    albumObj.put("title", aTitle != null ? aTitle : "Unknown Album");
                    albumObj.put("artist", aArtist != null ? aArtist : "Unknown Artist");
                    albumObj.put("cover", albumArtUri.toString());
                    albumObj.put("year", year);
                    albumObj.put("numSongs", numSongs);

                    albums.put(albumObj);
                }
                albumCursor.close();
            }

            // === Scan Artists ===
            Uri artistUri = MediaStore.Audio.Artists.EXTERNAL_CONTENT_URI;
            String[] artistProjection = {
                MediaStore.Audio.Artists._ID,
                MediaStore.Audio.Artists.ARTIST,
                MediaStore.Audio.Artists.NUMBER_OF_TRACKS,
                MediaStore.Audio.Artists.NUMBER_OF_ALBUMS
            };

            Cursor artistCursor = resolver.query(artistUri, artistProjection, null, null,
                MediaStore.Audio.Artists.ARTIST + " ASC");

            if (artistCursor != null) {
                while (artistCursor.moveToNext()) {
                    JSObject artistObj = new JSObject();
                    long arId = artistCursor.getLong(artistCursor.getColumnIndexOrThrow(MediaStore.Audio.Artists._ID));
                    String arName = artistCursor.getString(artistCursor.getColumnIndexOrThrow(MediaStore.Audio.Artists.ARTIST));
                    int numTracks = artistCursor.getInt(artistCursor.getColumnIndexOrThrow(MediaStore.Audio.Artists.NUMBER_OF_TRACKS));
                    int numAlbums = artistCursor.getInt(artistCursor.getColumnIndexOrThrow(MediaStore.Audio.Artists.NUMBER_OF_ALBUMS));

                    artistObj.put("id", "ar_" + arId);
                    artistObj.put("name", arName != null && !arName.equals("<unknown>") ? arName : "Unknown Artist");
                    artistObj.put("numTracks", numTracks);
                    artistObj.put("numAlbums", numAlbums);
                    artistObj.put("image", ""); // No standard artist image in MediaStore

                    artists.put(artistObj);
                }
                artistCursor.close();
            }

            // Build response
            JSObject result = new JSObject();
            result.put("tracks", tracks);
            result.put("albums", albums);
            result.put("artists", artists);

            call.resolve(result);

        } catch (Exception e) {
            call.reject("Failed to scan music: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void chooseFolder(PluginCall call) {
        saveCall(call);
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        startActivityForResult(call, intent, "chooseFolderResult");
    }

    @ActivityCallback
    private void chooseFolderResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() == Activity.RESULT_OK) {
            Intent data = result.getData();
            if (data != null) {
                Uri uri = data.getData();
                final int takeFlags = data.getFlags() & (Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                getContext().getContentResolver().takePersistableUriPermission(uri, takeFlags);
                
                JSObject response = new JSObject();
                response.put("folderUri", uri.toString());
                response.put("folderPath", uri.getPath());
                call.resolve(response);
            } else {
                call.reject("No folder selected");
            }
        } else {
            call.reject("User cancelled folder selection");
        }
    }

    @PluginMethod
    public void scanFolder(PluginCall call) {
        String folderUriStr = call.getString("folderUri");
        if (folderUriStr == null) {
            call.reject("Folder URI is required");
            return;
        }

        new Thread(() -> {
            try {
                Uri folderUri = Uri.parse(folderUriStr);
                androidx.documentfile.provider.DocumentFile rootDir = 
                    androidx.documentfile.provider.DocumentFile.fromTreeUri(getContext(), folderUri);

                if (rootDir == null || !rootDir.exists()) {
                    call.reject("Folder not found or inaccessible");
                    return;
                }

                JSArray tracks = new JSArray();
                scanDirectory(rootDir, tracks);

                JSObject result = new JSObject();
                result.put("tracks", tracks);
                result.put("folder", rootDir.getName());
                call.resolve(result);

            } catch (Exception e) {
                call.reject("Folder scan failed: " + e.getMessage(), e);
            }
        }).start();
    }

    private void scanDirectory(androidx.documentfile.provider.DocumentFile dir, JSArray tracks) {
        androidx.documentfile.provider.DocumentFile[] files = dir.listFiles();
        for (androidx.documentfile.provider.DocumentFile file : files) {
            if (file.isDirectory()) {
                scanDirectory(file, tracks);
            } else if (file.isFile() && isAudioFile(file.getType())) {
                JSObject track = processAudioFile(file);
                if (track != null) {
                    tracks.put(track);
                }
            }
        }
    }

    private boolean isAudioFile(String mimeType) {
        return mimeType != null && (mimeType.startsWith("audio/") || mimeType.equals("application/ogg"));
    }

    private JSObject processAudioFile(androidx.documentfile.provider.DocumentFile file) {
        try {
            android.media.MediaMetadataRetriever mmr = new android.media.MediaMetadataRetriever();
            mmr.setDataSource(getContext(), file.getUri());

            String title = mmr.extractMetadata(android.media.MediaMetadataRetriever.METADATA_KEY_TITLE);
            String artist = mmr.extractMetadata(android.media.MediaMetadataRetriever.METADATA_KEY_ARTIST);
            String album = mmr.extractMetadata(android.media.MediaMetadataRetriever.METADATA_KEY_ALBUM);
            String durationStr = mmr.extractMetadata(android.media.MediaMetadataRetriever.METADATA_KEY_DURATION);
            
            // Generate stable IDs based on file info
            long id = file.getUri().toString().hashCode(); 
            long albumId = (album != null ? album : "Unknown").hashCode();
            long artistId = (artist != null ? artist : "Unknown").hashCode();

            JSObject track = new JSObject();
            track.put("id", "t_" + Math.abs(id));
            track.put("title", title != null ? title : file.getName());
            track.put("artist", artist != null ? artist : "Unknown Artist");
            track.put("album", album != null ? album : "Unknown Album");
            track.put("albumId", "a_" + Math.abs(albumId));
            track.put("artistId", "ar_" + Math.abs(artistId));
            track.put("duration", durationStr != null ? Long.parseLong(durationStr) / 1000 : 0);
            track.put("src", file.getUri().toString());
            track.put("contentUri", file.getUri().toString());
            
            // Extract and cache album art
            byte[] artData = mmr.getEmbeddedPicture();
            String artPath = cacheAlbumArt(artData, "a_" + Math.abs(albumId));
            track.put("cover", artPath != null ? "file://" + artPath : "");

            try {
                mmr.release();
            } catch (Exception ignored) {}

            return track;
        } catch (Exception e) {
            // Fallback for unreadable files
            return null;
        }
    }

    private String cacheAlbumArt(byte[] data, String fileName) {
        if (data == null || data.length == 0) return null;
        try {
            File cacheDir = getContext().getCacheDir();
            File artDir = new File(cacheDir, "album_covers");
            if (!artDir.exists()) artDir.mkdirs();

            File file = new File(artDir, fileName + ".jpg");
            // Optimization: If file exists and acts as a cache, skip writing. 
            // However, different albums might conflict if hashing is weak, but for now assuming albumId hash + file name is unique enough or consistent.
            if (file.exists() && file.length() > 0) {
                return file.getAbsolutePath();
            }

            java.io.FileOutputStream fos = new java.io.FileOutputStream(file);
            fos.write(data);
            fos.close();
            return file.getAbsolutePath();
        } catch (Exception e) {
            return null;
        }
    }

    @PluginMethod
    public void scanDownloads(PluginCall call) {
        try {
            JSArray tracks = new JSArray();
            ContentResolver resolver = getContext().getContentResolver();
            Uri audioUri = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;
            
            String[] projection = {
                MediaStore.Audio.Media._ID,
                MediaStore.Audio.Media.TITLE,
                MediaStore.Audio.Media.ARTIST,
                MediaStore.Audio.Media.ALBUM,
                MediaStore.Audio.Media.ALBUM_ID,
                MediaStore.Audio.Media.ARTIST_ID,
                MediaStore.Audio.Media.DURATION,
                MediaStore.Audio.Media.DATA,
                MediaStore.Audio.Media.RELATIVE_PATH
            };

            // Modern Android uses RELATIVE_PATH
            String selection = "(" + MediaStore.Audio.Media.RELATIVE_PATH + " LIKE ? OR " + 
                              MediaStore.Audio.Media.DATA + " LIKE ?) AND " + 
                              MediaStore.Audio.Media.IS_MUSIC + " != 0";
            
            String[] selectionArgs = new String[]{"%Download%", "%Download%"};

            Cursor cursor = resolver.query(audioUri, projection, selection, selectionArgs, MediaStore.Audio.Media.TITLE + " ASC");

            if (cursor != null) {
                while (cursor.moveToNext()) {
                    JSObject track = new JSObject();
                    long id = cursor.getLong(cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID));
                    long albumId = cursor.getLong(cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM_ID));
                    long artistId = cursor.getLong(cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST_ID));
                    long duration = cursor.getLong(cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION));
                    String title = cursor.getString(cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.TITLE));
                    String artist = cursor.getString(cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST));
                    String album = cursor.getString(cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM));
                    String data = cursor.getString(cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DATA));

                    Uri contentUri = Uri.withAppendedPath(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, String.valueOf(id));
                    Uri albumArtUri = Uri.parse("content://media/external/audio/albumart/" + albumId);

                    track.put("id", "t_" + id);
                    track.put("title", title != null ? title : "Unknown");
                    track.put("artist", artist != null && !artist.equals("<unknown>") ? artist : "Unknown Artist");
                    track.put("album", album != null && !album.equals("<unknown>") ? album : "Unknown Album");
                    track.put("albumId", "a_" + albumId);
                    track.put("artistId", "ar_" + artistId);
                    track.put("duration", duration / 1000);
                    track.put("src", data);
                    track.put("contentUri", contentUri.toString());
                    track.put("cover", albumArtUri.toString());

                    tracks.put(track);
                }
                cursor.close();
            }

            JSObject result = new JSObject();
            result.put("tracks", tracks);
            call.resolve(result);

        } catch (Exception e) {
            call.reject("Scan downloads failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void requestPermissions(PluginCall call) {
        super.requestPermissions(call);
    }

    @PluginMethod
    public void checkPermissions(PluginCall call) {
        super.checkPermissions(call);
    }
}
