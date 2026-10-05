package com.vikash.lifeai;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

public class AlarmActionReceiver extends BroadcastReceiver {
    private static final String TAG = "AlarmActionReceiver";
    public static final String ACTION_DISMISS = "com.vikash.lifeai.ACTION_DISMISS";
    public static final String ACTION_SNOOZE = "com.vikash.lifeai.ACTION_SNOOZE";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        String alarmId = intent.getStringExtra("alarm_id");
        Log.i(TAG, "Received alarm action: " + action + " for alarm: " + alarmId);

        // Stop the ringing service
        Intent stopService = new Intent(context, AlarmRingService.class);
        stopService.setAction(AlarmRingService.ACTION_STOP);
        context.startService(stopService);

        if (ACTION_DISMISS.equals(action)) {
            Log.i(TAG, "Dismissing alarm: " + alarmId);
            // Disable one-time alarm in storage
            if (alarmId != null) {
                AlarmStorage.setAlarmEnabled(context, alarmId, false);
            }
        } else if (ACTION_SNOOZE.equals(action)) {
            Log.i(TAG, "Snoozing alarm for 5 minutes: " + alarmId);
            // Reschedule in 5 minutes
            long snoozeTrigger = System.currentTimeMillis() + (5 * 60 * 1000L);
            AlarmStorage.AlarmItem item = AlarmStorage.getAlarmById(context, alarmId);
            if (item != null) {
                item.triggerMillis = snoozeTrigger;
                item.enabled = true;
                AlarmEngine.scheduleAlarm(context, item);
            } else {
                AlarmStorage.AlarmItem snoozed = new AlarmStorage.AlarmItem();
                snoozed.id = "snooze_" + System.currentTimeMillis();
                snoozed.triggerMillis = snoozeTrigger;
                snoozed.timeStr = "Snoozed (+5m)";
                snoozed.label = "Snoozed Alarm";
                snoozed.enabled = true;
                snoozed.vibrate = true;
                snoozed.sound = true;
                AlarmEngine.scheduleAlarm(context, snoozed);
            }
        }
    }
}
