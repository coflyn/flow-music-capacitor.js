package com.coflyn.flow;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.MediaMetadataRetriever;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import androidx.media.app.NotificationCompat.MediaStyle;
import java.io.InputStream;

public class MediaPlaybackService extends Service {

    private static final String TAG = "FlowPlayback";
    public static final String CHANNEL_ID = "flow_playback_channel";
    public static final int NOTIFICATION_ID = 1;

    public static final String ACTION_UPDATE = "com.coflyn.flow.UPDATE";
    public static final String ACTION_PLAY = "com.coflyn.flow.PLAY";
    public static final String ACTION_PAUSE = "com.coflyn.flow.PAUSE";
    public static final String ACTION_NEXT = "com.coflyn.flow.NEXT";
    public static final String ACTION_PREV = "com.coflyn.flow.PREV";
    public static final String ACTION_STOP = "com.coflyn.flow.STOP";
    public static final String ACTION_SET_STATE = "com.coflyn.flow.SET_STATE";
    public static final String ACTION_UPDATE_POSITION = "com.coflyn.flow.UPDATE_POSITION";

    public static final String BROADCAST_ACTION = "com.coflyn.flow.MEDIA_ACTION";

    private MediaSessionCompat mediaSession;
    private String currentTitle = "Flow";
    private String currentArtist = "";
    private String currentAlbum = "";
    private boolean isPlaying = false;
    private Bitmap currentArt = null;
    private long currentPosition = 0;
    private long currentDuration = 0;
    private String lastCoverKey = "";
    private BroadcastReceiver headsetReceiver;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();

        mediaSession = new MediaSessionCompat(this, "FlowMediaSession");
        mediaSession.setFlags(
            MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS |
            MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS
        );

        mediaSession.setCallback(new MediaSessionCompat.Callback() {
            @Override
            public void onPlay() {
                isPlaying = true;
                updateNotification();
                broadcastAction("play");
            }
            @Override
            public void onPause() {
                isPlaying = false;
                updateNotification();
                broadcastAction("pause");
            }
            @Override
            public void onSkipToNext() {
                broadcastAction("next");
            }
            @Override
            public void onSkipToPrevious() {
                broadcastAction("prev");
            }
            @Override
            public void onSeekTo(long pos) {
                currentPosition = pos;
                updatePlaybackState();
                broadcastAction("seekTo:" + pos);
            }
            @Override
            public void onStop() {
                stopForeground(true);
                stopSelf();
            }
        });

        mediaSession.setActive(true);

        headsetReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (Intent.ACTION_HEADSET_PLUG.equals(intent.getAction())) {
                    int state = intent.getIntExtra("state", -1);
                    if (state == 0) {
                        broadcastAction("headsetDisconnected");
                    } else if (state == 1) {
                        broadcastAction("headsetConnected");
                    }
                }
            }
        };
        registerReceiver(headsetReceiver, new IntentFilter(Intent.ACTION_HEADSET_PLUG));
    }

    /**
     * Send broadcast to NowPlayingPlugin.
     * Uses an explicit intent targeting this app's package to work with RECEIVER_NOT_EXPORTED.
     */
    private void broadcastAction(String action) {
        Intent intent = new Intent(BROADCAST_ACTION);
        intent.setPackage(getPackageName());
        intent.putExtra("action", action);
        sendBroadcast(intent);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_STICKY;

        String action = intent.getAction();
        if (action == null) action = "";

        // Android 12+ Requirement: Must call startForeground within 5 seconds of Service start.
        if (!action.equals(ACTION_STOP)) {
            updateNotification();
        }

        switch (action) {
            case ACTION_UPDATE:
                updateNotification(); 

                currentTitle = intent.getStringExtra("title");
                currentArtist = intent.getStringExtra("artist");
                currentAlbum = intent.getStringExtra("album");
                String trackUri = intent.getStringExtra("trackUri");
                String coverUri = intent.getStringExtra("coverUri");
                isPlaying = intent.getBooleanExtra("isPlaying", false);
                currentDuration = intent.getLongExtra("duration", 0);

                if (currentTitle == null) currentTitle = "Flow";
                if (currentArtist == null) currentArtist = "";
                if (currentAlbum == null) currentAlbum = "";

                String coverKey = (coverUri != null ? coverUri : "") + "|" + (trackUri != null ? trackUri : "");
                if (!coverKey.equals(lastCoverKey)) {
                    lastCoverKey = coverKey;
                    loadCoverArt(coverUri, trackUri);
                } else {
                    updateNotification();
                }
                break;

            case ACTION_PLAY:
                isPlaying = true;
                updateNotification();
                broadcastAction("play");
                break;

            case ACTION_PAUSE:
                isPlaying = false;
                updateNotification();
                broadcastAction("pause");
                break;

            case ACTION_NEXT:
                broadcastAction("next");
                break;

            case ACTION_PREV:
                broadcastAction("prev");
                break;

            case ACTION_SET_STATE:
                isPlaying = intent.getBooleanExtra("isPlaying", false);
                updateNotification();
                break;
                
            case ACTION_UPDATE_POSITION:
                currentPosition = intent.getLongExtra("position", 0);
                currentDuration = intent.getLongExtra("duration", 0);
                updatePlaybackState();
                break;

            case ACTION_STOP:
                stopForeground(true);
                stopSelf();
                break;

            default:
                updateNotification();
                break;
        }

        return START_STICKY;
    }

    /**
     * Try multiple methods to load album art:
     * 1. Content URI for album art (content://media/external/audio/albumart/...)
     * 2. MediaMetadataRetriever from the track's content URI (embedded art)
     */
    private void loadCoverArt(String coverUri, String trackUri) {
        new Thread(() -> {
            Bitmap art = null;

            // Method 1: Try album art content URI
            if (coverUri != null && !coverUri.isEmpty()) {
                try {
                    ContentResolver resolver = getContentResolver();
                    InputStream in = resolver.openInputStream(Uri.parse(coverUri));
                    if (in != null) {
                        art = BitmapFactory.decodeStream(in);
                        in.close();
                    }
                } catch (Exception e) {
                    Log.d(TAG, "Album art URI failed: " + e.getMessage());
                }
            }

            // Method 2: Try embedded art via MediaMetadataRetriever
            if (art == null && trackUri != null && !trackUri.isEmpty()) {
                MediaMetadataRetriever retriever = new MediaMetadataRetriever();
                try {
                    retriever.setDataSource(this, Uri.parse(trackUri));
                    byte[] artBytes = retriever.getEmbeddedPicture();
                    if (artBytes != null) {
                        art = BitmapFactory.decodeByteArray(artBytes, 0, artBytes.length);
                    }
                } catch (Exception e) {
                    Log.d(TAG, "Embedded art extraction failed: " + e.getMessage());
                } finally {
                    try { retriever.release(); } catch (Exception ignored) {}
                }
            }

            // Scale down for notification (max 512x512 to save memory)
            if (art != null && (art.getWidth() > 512 || art.getHeight() > 512)) {
                float scale = 512f / Math.max(art.getWidth(), art.getHeight());
                art = Bitmap.createScaledBitmap(art,
                    (int)(art.getWidth() * scale),
                    (int)(art.getHeight() * scale), true);
            }

            currentArt = art;
            new android.os.Handler(getMainLooper()).post(this::updateNotification);
        }).start();
    }

    private void updatePlaybackState() {
        PlaybackStateCompat.Builder stateBuilder = new PlaybackStateCompat.Builder()
            .setActions(
                PlaybackStateCompat.ACTION_PLAY |
                PlaybackStateCompat.ACTION_PAUSE |
                PlaybackStateCompat.ACTION_SKIP_TO_NEXT |
                PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS |
                PlaybackStateCompat.ACTION_STOP |
                PlaybackStateCompat.ACTION_PLAY_PAUSE |
                PlaybackStateCompat.ACTION_SEEK_TO
            )
            .setState(
                isPlaying ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED,
                currentPosition,
                isPlaying ? 1.0f : 0f
            );

        mediaSession.setPlaybackState(stateBuilder.build());
    }

    private void updateNotification() {
        if (mediaSession == null) return;
        
        // Update MediaSession metadata
        MediaMetadataCompat.Builder metaBuilder = new MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, currentTitle)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, currentArtist)
            .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, currentAlbum)
            .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, currentDuration);

        if (currentArt != null) {
            metaBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, currentArt);
        }

        mediaSession.setMetadata(metaBuilder.build());
        updatePlaybackState();

        // Build notification
        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent contentIntent = PendingIntent.getActivity(
            this, 0, openIntent, PendingIntent.FLAG_IMMUTABLE
        );

        PendingIntent prevIntent = createActionIntent(ACTION_PREV, 1);
        PendingIntent playPauseIntent = createActionIntent(isPlaying ? ACTION_PAUSE : ACTION_PLAY, 2);
        PendingIntent nextIntent = createActionIntent(ACTION_NEXT, 3);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setContentTitle(currentTitle)
            .setContentText(currentArtist)
            .setSubText(currentAlbum)
            .setContentIntent(contentIntent)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(isPlaying)
            .setShowWhen(false)
            .addAction(android.R.drawable.ic_media_previous, "Previous", prevIntent)
            .addAction(
                isPlaying ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play,
                isPlaying ? "Pause" : "Play",
                playPauseIntent
            )
            .addAction(android.R.drawable.ic_media_next, "Next", nextIntent)
            .setStyle(new MediaStyle()
                .setMediaSession(mediaSession.getSessionToken())
                .setShowActionsInCompactView(0, 1, 2)
            );

        if (currentArt != null) {
            builder.setLargeIcon(currentArt);
        }

        Notification notification = builder.build();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    private PendingIntent createActionIntent(String action, int requestCode) {
        Intent intent = new Intent(this, MediaPlaybackService.class);
        intent.setAction(action);
        return PendingIntent.getService(this, requestCode, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Flow Playback",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Shows current playing track");
            channel.setShowBadge(false);
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);

            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        if (mediaSession != null) {
            mediaSession.setActive(false);
            mediaSession.release();
        }
        if (headsetReceiver != null) {
            unregisterReceiver(headsetReceiver);
        }
        super.onDestroy();
    }
}
