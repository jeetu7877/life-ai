package com.vikash.lifeai;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.PowerManager;
import android.util.Log;
import androidx.core.content.ContextCompat;

public class AlarmReceiver extends BroadcastReceiver {
    private static final String TAG = "AlarmReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent != null ? intent.getAction() : null;
        Log.i(TAG, "Alarm triggered! Action: " + action);

        // Acquire WakeLock to turn on screen and guarantee CPU wakefulness
        PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        PowerManager.WakeLock wakeLock = null;
        if (pm != null) {
            wakeLock = pm.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP,
                "LifeAI:AlarmWakeLock"
            );
            wakeLock.acquire(15000); // 15 sec lock to start foreground service
        }

        String alarmId = intent != null ? intent.getStringExtra("alarm_id") : "unknown";
        String alarmLabel = intent != null ? intent.getStringExtra("alarm_label") : "Alarm";
        boolean sound = intent == null || intent.getBooleanExtra("alarm_sound", true);
        boolean vibrate = intent == null || intent.getBooleanExtra("alarm_vibrate", true);

        Intent serviceIntent = new Intent(context, AlarmRingService.class);
        serviceIntent.setAction(AlarmRingService.ACTION_RING);
        serviceIntent.putExtra("alarm_id", alarmId);
        serviceIntent.putExtra("alarm_label", alarmLabel);
        serviceIntent.putExtra("alarm_sound", sound);
        serviceIntent.putExtra("alarm_vibrate", vibrate);

        try {
            ContextCompat.startForegroundService(context, serviceIntent);
            Log.i(TAG, "AlarmRingService foreground service started for alarm: " + alarmId);
        } catch (Exception e) {
            Log.e(TAG, "Failed to start AlarmRingService: " + e.getMessage());
        }
    }
}
