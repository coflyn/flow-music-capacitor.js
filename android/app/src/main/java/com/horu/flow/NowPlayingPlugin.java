package com.horu.flow;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.media.AudioManager;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

@CapacitorPlugin(
    name = "NowPlaying",
    permissions = {
        @Permission(alias = "notifications", strings = { "android.permission.POST_NOTIFICATIONS" })
    }
)
public class NowPlayingPlugin extends Plugin {

    private BroadcastReceiver mediaActionReceiver;

    @Override
    public void load() {
        mediaActionReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                String action = intent.getStringExtra("action");
                if (action != null) {
                    JSObject data = new JSObject();
                    data.put("action", action);
                    notifyListeners("mediaAction", data);
                }
            }
        };

        IntentFilter filter = new IntentFilter(MediaPlaybackService.BROADCAST_ACTION);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getContext().registerReceiver(mediaActionReceiver, filter, Context.RECEIVER_EXPORTED);
        } else {
            getContext().registerReceiver(mediaActionReceiver, filter);
        }
    }

    @PluginMethod
    public void updateNotification(PluginCall call) {
        String title = call.getString("title", "Flow");
        String artist = call.getString("artist", "");
        String album = call.getString("album", "");
        String coverUri = call.getString("coverUri", "");
        String trackUri = call.getString("trackUri", "");
        boolean isPlaying = call.getBoolean("isPlaying", false);
        long duration = (long)(call.getDouble("duration", 0.0) * 1000); // JS sends seconds, convert to ms

        Intent serviceIntent = new Intent(getContext(), MediaPlaybackService.class);
        serviceIntent.setAction(MediaPlaybackService.ACTION_UPDATE);
        serviceIntent.putExtra("title", title);
        serviceIntent.putExtra("artist", artist);
        serviceIntent.putExtra("album", album);
        serviceIntent.putExtra("coverUri", coverUri);
        serviceIntent.putExtra("trackUri", trackUri);
        serviceIntent.putExtra("isPlaying", isPlaying);
        serviceIntent.putExtra("duration", duration);

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getContext().startForegroundService(serviceIntent);
            } else {
                getContext().startService(serviceIntent);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to update notification: " + e.getMessage());
        }
    }

    @PluginMethod
    public void updatePlaybackState(PluginCall call) {
        boolean isPlaying = call.getBoolean("isPlaying", false);

        Intent serviceIntent = new Intent(getContext(), MediaPlaybackService.class);
        serviceIntent.setAction(MediaPlaybackService.ACTION_SET_STATE);
        serviceIntent.putExtra("isPlaying", isPlaying);

        try {
            getContext().startService(serviceIntent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to update playback state: " + e.getMessage());
        }
    }

    @PluginMethod
    public void updatePosition(PluginCall call) {
        long position = (long)(call.getDouble("position", 0.0) * 1000); // seconds to ms
        long duration = (long)(call.getDouble("duration", 0.0) * 1000);

        Intent serviceIntent = new Intent(getContext(), MediaPlaybackService.class);
        serviceIntent.setAction(MediaPlaybackService.ACTION_UPDATE_POSITION);
        serviceIntent.putExtra("position", position);
        serviceIntent.putExtra("duration", duration);

        try {
            getContext().startService(serviceIntent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to update position: " + e.getMessage());
        }
    }

    @PluginMethod
    public void destroy(PluginCall call) {
        Intent serviceIntent = new Intent(getContext(), MediaPlaybackService.class);
        serviceIntent.setAction(MediaPlaybackService.ACTION_STOP);
        try {
            getContext().startService(serviceIntent);
        } catch (Exception ignored) {}
        call.resolve();
    }

    @PluginMethod
    public void showVolume(PluginCall call) {
        AudioManager audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        if (audioManager != null) {
            audioManager.adjustStreamVolume(AudioManager.STREAM_MUSIC, AudioManager.ADJUST_SAME, AudioManager.FLAG_SHOW_UI);
            call.resolve();
        } else {
            call.reject("Audio Service not available");
        }
    }

    @Override
    protected void handleOnDestroy() {
        if (mediaActionReceiver != null) {
            try {
                getContext().unregisterReceiver(mediaActionReceiver);
            } catch (Exception ignored) {}
        }
    }
}
