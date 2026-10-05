package com.vikash.lifeai;

import android.app.AlarmManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.List;

@CapacitorPlugin(name = "AlarmPlugin")
public class AlarmPlugin extends Plugin {
    private static final String TAG = "AlarmPlugin";

    @PluginMethod
    public void setAlarm(PluginCall call) {
        try {
            String id = call.getString("id", String.valueOf(System.currentTimeMillis()));
            Long triggerMillis = call.getLong("triggerMillis");
            String timeStr = call.getString("timeStr", "");
            String label = call.getString("label", "Alarm");
            boolean sound = call.getBoolean("sound", true);
            boolean vibrate = call.getBoolean("vibrate", true);

            if (triggerMillis == null || triggerMillis == 0) {
                call.reject("triggerMillis is required");
                return;
            }

            AlarmStorage.AlarmItem item = new AlarmStorage.AlarmItem();
            item.id = id;
            item.triggerMillis = triggerMillis;
            item.timeStr = timeStr;
            item.label = label;
            item.enabled = true;
            item.sound = sound;
            item.vibrate = vibrate;

            boolean scheduled = AlarmEngine.scheduleAlarm(getContext(), item);
            if (scheduled) {
                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("id", item.id);
                ret.put("triggerMillis", item.triggerMillis);
                ret.put("timeStr", item.timeStr);
                ret.put("label", item.label);
                call.resolve(ret);
            } else {
                call.reject("Failed to schedule alarm via Android AlarmManager");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error in setAlarm: " + e.getMessage());
            call.reject("Error setting alarm: " + e.getMessage());
        }
    }

    @PluginMethod
    public void cancelAlarm(PluginCall call) {
        try {
            String id = call.getString("id");
            if (id == null || id.isEmpty()) {
                call.reject("id is required");
                return;
            }

            AlarmEngine.cancelAlarm(getContext(), id);
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("id", id);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Error in cancelAlarm: " + e.getMessage());
            call.reject("Error cancelling alarm: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getAlarms(PluginCall call) {
        try {
            List<AlarmStorage.AlarmItem> list = AlarmStorage.getAllAlarms(getContext());
            JSArray arr = new JSArray();
            for (AlarmStorage.AlarmItem item : list) {
                JSObject obj = new JSObject();
                obj.put("id", item.id);
                obj.put("triggerMillis", item.triggerMillis);
                obj.put("timeStr", item.timeStr);
                obj.put("label", item.label);
                obj.put("enabled", item.enabled);
                obj.put("sound", item.sound);
                obj.put("vibrate", item.vibrate);
                arr.put(obj);
            }
            JSObject ret = new JSObject();
            ret.put("alarms", arr);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Error in getAlarms: " + e.getMessage());
            call.reject("Error retrieving alarms: " + e.getMessage());
        }
    }

    @PluginMethod
    public void testAlarm(PluginCall call) {
        try {
            long testTrigger = System.currentTimeMillis() + 4000; // Ring in 4 seconds
            AlarmStorage.AlarmItem testItem = new AlarmStorage.AlarmItem();
            testItem.id = "test_" + System.currentTimeMillis();
            testItem.triggerMillis = testTrigger;
            testItem.timeStr = "Test in 4s";
            testItem.label = "Life AI Alarm Test";
            testItem.enabled = true;
            testItem.sound = true;
            testItem.vibrate = true;

            boolean ok = AlarmEngine.scheduleAlarm(getContext(), testItem);
            JSObject ret = new JSObject();
            ret.put("success", ok);
            ret.put("message", "Test alarm scheduled for 4 seconds from now");
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to schedule test alarm: " + e.getMessage());
        }
    }

    @PluginMethod
    public void dismissActiveAlarm(PluginCall call) {
        try {
            Intent stopIntent = new Intent(getContext(), AlarmRingService.class);
            stopIntent.setAction(AlarmRingService.ACTION_STOP);
            getContext().startService(stopIntent);
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to dismiss alarm: " + e.getMessage());
        }
    }

    @PluginMethod
    public void canScheduleExactAlarms(PluginCall call) {
        boolean canSchedule = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            AlarmManager alarmManager = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
            if (alarmManager != null) {
                canSchedule = alarmManager.canScheduleExactAlarms();
            }
        }
        JSObject ret = new JSObject();
        ret.put("canSchedule", canSchedule);
        call.resolve(ret);
    }

    @PluginMethod
    public void openAlarmSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            try {
                Intent intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                getContext().startActivity(intent);
                JSObject ret = new JSObject();
                ret.put("opened", true);
                call.resolve(ret);
                return;
            } catch (Exception ignored) {}
        }
        JSObject ret = new JSObject();
        ret.put("opened", false);
        call.resolve(ret);
    }
}
