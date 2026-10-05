package com.vikash.lifeai;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.List;

public class AlarmStorage {
    private static final String TAG = "AlarmStorage";
    private static final String PREF_NAME = "life_ai_alarms_store";
    private static final String KEY_ALARMS = "alarms_list";

    public static class AlarmItem {
        public String id;
        public long triggerMillis;
        public String timeStr;
        public String label;
        public boolean enabled;
        public boolean vibrate;
        public boolean sound;

        public JSONObject toJson() {
            JSONObject obj = new JSONObject();
            try {
                obj.put("id", id);
                obj.put("triggerMillis", triggerMillis);
                obj.put("timeStr", timeStr);
                obj.put("label", label);
                obj.put("enabled", enabled);
                obj.put("vibrate", vibrate);
                obj.put("sound", sound);
            } catch (Exception e) {
                Log.e(TAG, "Error serializing alarm to JSON: " + e.getMessage());
            }
            return obj;
        }

        public static AlarmItem fromJson(JSONObject obj) {
            AlarmItem item = new AlarmItem();
            item.id = obj.optString("id", String.valueOf(System.currentTimeMillis()));
            item.triggerMillis = obj.optLong("triggerMillis", 0);
            item.timeStr = obj.optString("timeStr", "");
            item.label = obj.optString("label", "Alarm");
            item.enabled = obj.optBoolean("enabled", true);
            item.vibrate = obj.optBoolean("vibrate", true);
            item.sound = obj.optBoolean("sound", true);
            return item;
        }
    }

    public static synchronized List<AlarmItem> getAllAlarms(Context context) {
        List<AlarmItem> list = new ArrayList<>();
        if (context == null) return list;
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
            String rawJson = prefs.getString(KEY_ALARMS, "[]");
            JSONArray arr = new JSONArray(rawJson);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject obj = arr.getJSONObject(i);
                list.add(AlarmItem.fromJson(obj));
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to load alarms: " + e.getMessage());
        }
        return list;
    }

    public static synchronized void saveAlarm(Context context, AlarmItem alarm) {
        if (context == null || alarm == null) return;
        List<AlarmItem> current = getAllAlarms(context);
        boolean updated = false;
        for (int i = 0; i < current.size(); i++) {
            if (current.get(i).id.equals(alarm.id)) {
                current.set(i, alarm);
                updated = true;
                break;
            }
        }
        if (!updated) {
            current.add(alarm);
        }
        persistList(context, current);
    }

    public static synchronized void deleteAlarm(Context context, String id) {
        if (context == null || id == null) return;
        List<AlarmItem> current = getAllAlarms(context);
        List<AlarmItem> filtered = new ArrayList<>();
        for (AlarmItem item : current) {
            if (!item.id.equals(id)) {
                filtered.add(item);
            }
        }
        persistList(context, filtered);
    }

    public static synchronized void setAlarmEnabled(Context context, String id, boolean enabled) {
        if (context == null || id == null) return;
        List<AlarmItem> current = getAllAlarms(context);
        for (AlarmItem item : current) {
            if (item.id.equals(id)) {
                item.enabled = enabled;
                break;
            }
        }
        persistList(context, current);
    }

    public static synchronized AlarmItem getAlarmById(Context context, String id) {
        if (context == null || id == null) return null;
        List<AlarmItem> current = getAllAlarms(context);
        for (AlarmItem item : current) {
            if (item.id.equals(id)) {
                return item;
            }
        }
        return null;
    }

    private static void persistList(Context context, List<AlarmItem> list) {
        try {
            JSONArray arr = new JSONArray();
            for (AlarmItem item : list) {
                arr.put(item.toJson());
            }
            SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
            prefs.edit().putString(KEY_ALARMS, arr.toString()).apply();
            Log.d(TAG, "Persisted " + list.size() + " alarms to local storage.");
        } catch (Exception e) {
            Log.e(TAG, "Failed to persist alarms: " + e.getMessage());
        }
    }
}
