package com.vikash.lifeai;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.util.Log;
import androidx.core.app.NotificationCompat;

public class AlarmRingService extends Service {
    private static final String TAG = "AlarmRingService";
    public static final String CHANNEL_ID = "life_ai_alarm_channel";
    public static final int NOTIFICATION_ID = 8801;

    public static final String ACTION_RING = "com.vikash.lifeai.ACTION_RING";
    public static final String ACTION_STOP = "com.vikash.lifeai.ACTION_STOP";

    private MediaPlayer mediaPlayer;
    private Vibrator vibrator;
    private Handler autoStopHandler;
    private Runnable autoStopRunnable;
    private String currentAlarmId;
    private String currentAlarmLabel;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        autoStopHandler = new Handler(Looper.getMainLooper());
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_NOT_STICKY;

        String action = intent.getAction();
        Log.i(TAG, "AlarmRingService action: " + action);

        if (ACTION_STOP.equals(action)) {
            stopRinging();
            stopSelf();
            return START_NOT_STICKY;
        }

        if (ACTION_RING.equals(action)) {
            currentAlarmId = intent.getStringExtra("alarm_id");
            currentAlarmLabel = intent.getStringExtra("alarm_label");
            if (currentAlarmLabel == null || currentAlarmLabel.isEmpty()) {
                currentAlarmLabel = "Life AI Alarm";
            }
            boolean sound = intent.getBooleanExtra("alarm_sound", true);
            boolean vibrate = intent.getBooleanExtra("alarm_vibrate", true);

            Notification notification = buildAlarmNotification(currentAlarmId, currentAlarmLabel);
            startForeground(NOTIFICATION_ID, notification);

            if (sound) {
                startAlarmSound();
            }
            if (vibrate) {
                startVibration();
            }

            // Auto-stop after 10 minutes of ringing if untouched
            if (autoStopRunnable != null) {
                autoStopHandler.removeCallbacks(autoStopRunnable);
            }
            autoStopRunnable = () -> {
                Log.i(TAG, "Alarm auto-silenced after 10 minutes.");
                stopRinging();
                stopSelf();
            };
            autoStopHandler.postDelayed(autoStopRunnable, 10 * 60 * 1000L);
        }

        return START_STICKY;
    }

    private void startAlarmSound() {
        try {
            Uri alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            if (alarmUri == null) {
                alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            }
            if (alarmUri == null) {
                alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            }

            if (mediaPlayer != null) {
                mediaPlayer.release();
            }

            mediaPlayer = new MediaPlayer();
            mediaPlayer.setDataSource(this, alarmUri);

            AudioAttributes attrs = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
            mediaPlayer.setAudioAttributes(attrs);
            mediaPlayer.setAudioStreamType(AudioManager.STREAM_ALARM);
            mediaPlayer.setLooping(true);
            mediaPlayer.prepare();
            mediaPlayer.start();
            Log.i(TAG, "Alarm MediaPlayer looping playback started.");
        } catch (Exception e) {
            Log.e(TAG, "Error playing alarm sound: " + e.getMessage());
        }
    }

    private void startVibration() {
        try {
            vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (vibrator != null && vibrator.hasVibrator()) {
                long[] pattern = { 0, 800, 400, 800, 400 };
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0));
                } else {
                    vibrator.vibrate(pattern, 0);
                }
                Log.i(TAG, "Alarm vibration pattern started.");
            }
        } catch (Exception e) {
            Log.w(TAG, "Error starting vibration: " + e.getMessage());
        }
    }

    private void stopRinging() {
        if (autoStopRunnable != null) {
            autoStopHandler.removeCallbacks(autoStopRunnable);
            autoStopRunnable = null;
        }

        if (mediaPlayer != null) {
            try {
                if (mediaPlayer.isPlaying()) {
                    mediaPlayer.stop();
                }
                mediaPlayer.release();
            } catch (Exception ignored) {}
            mediaPlayer = null;
        }

        if (vibrator != null) {
            try {
                vibrator.cancel();
            } catch (Exception ignored) {}
            vibrator = null;
        }

        stopForeground(true);
        Log.i(TAG, "Alarm ringing stopped.");
    }

    private Notification buildAlarmNotification(String alarmId, String label) {
        // Intent for DISMISS action
        Intent dismissIntent = new Intent(this, AlarmActionReceiver.class);
        dismissIntent.setAction(AlarmActionReceiver.ACTION_DISMISS);
        dismissIntent.putExtra("alarm_id", alarmId);
        PendingIntent dismissPendingIntent = PendingIntent.getBroadcast(
            this,
            101,
            dismissIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Intent for SNOOZE action (+5 min)
        Intent snoozeIntent = new Intent(this, AlarmActionReceiver.class);
        snoozeIntent.setAction(AlarmActionReceiver.ACTION_SNOOZE);
        snoozeIntent.putExtra("alarm_id", alarmId);
        PendingIntent snoozePendingIntent = PendingIntent.getBroadcast(
            this,
            102,
            snoozeIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Full-screen Intent (Alarm Dismiss Screen)
        Intent fullScreenIntent = new Intent(this, AlarmDismissActivity.class);
        fullScreenIntent.putExtra("alarm_id", alarmId);
        fullScreenIntent.putExtra("alarm_label", label);
        fullScreenIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent fullScreenPendingIntent = PendingIntent.getActivity(
            this,
            103,
            fullScreenIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("⏰ " + label)
            .setContentText("Alarm is ringing — tap to Snooze or Dismiss")
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
            .setContentIntent(fullScreenPendingIntent)
            .setFullScreenIntent(fullScreenPendingIntent, true)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Dismiss", dismissPendingIntent)
            .addAction(android.R.drawable.ic_popup_sync, "Snooze (5m)", snoozePendingIntent);

        return builder.build();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Life AI Alarms",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Critical notifications for scheduled Life AI alarms");
            channel.enableVibration(true);
            channel.setBypassDnd(true);
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);

            NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    @Override
    public void onDestroy() {
        stopRinging();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
