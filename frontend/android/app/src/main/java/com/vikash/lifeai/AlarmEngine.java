package com.vikash.lifeai;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;
import java.util.List;

public class AlarmEngine {
    private static final String TAG = "AlarmEngine";
    public static final String ACTION_TRIGGER = "com.vikash.lifeai.ALARM_TRIGGER";

    /**
     * Schedules a native Android alarm.
     */
    public static boolean scheduleAlarm(Context context, AlarmStorage.AlarmItem alarm) {
        if (context == null || alarm == null) return false;

        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) {
            Log.e(TAG, "AlarmManager not available on this device.");
            return false;
        }

        // Ensure trigger time is in the future
        long triggerMillis = alarm.triggerMillis;
        long now = System.currentTimeMillis();
        if (triggerMillis <= now) {
            // If in the past, add 24 hours
            triggerMillis += 24 * 60 * 60 * 1000L;
            alarm.triggerMillis = triggerMillis;
        }

        Intent intent = new Intent(context, AlarmReceiver.class);
        intent.setAction(ACTION_TRIGGER);
        intent.putExtra("alarm_id", alarm.id);
        intent.putExtra("alarm_label", alarm.label);
        intent.putExtra("alarm_sound", alarm.sound);
        intent.putExtra("alarm_vibrate", alarm.vibrate);

        int reqCode = Math.abs(alarm.id.hashCode());
        PendingIntent pendingIntent = PendingIntent.getBroadcast(
            context,
            reqCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Intent for AlarmClockInfo (tapping clock icon in system bar opens app)
        Intent showIntent = new Intent(context, MainActivity.class);
        PendingIntent showPendingIntent = PendingIntent.getActivity(
            context,
            reqCode,
            showIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                AlarmManager.AlarmClockInfo clockInfo = new AlarmManager.AlarmClockInfo(triggerMillis, showPendingIntent);
                alarmManager.setAlarmClock(clockInfo, pendingIntent);
                Log.i(TAG, "Scheduled exact AlarmClock for id=" + alarm.id + " at " + triggerMillis + " (" + alarm.timeStr + ")");
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerMillis, pendingIntent);
                Log.i(TAG, "Scheduled exactAndAllowWhileIdle for id=" + alarm.id);
            } else {
                alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerMillis, pendingIntent);
                Log.i(TAG, "Scheduled setExact for id=" + alarm.id);
            }
            // Save updated alarm (including any adjusted triggerMillis)
            AlarmStorage.saveAlarm(context, alarm);
            return true;
        } catch (SecurityException se) {
            Log.w(TAG, "SecurityException scheduling exact alarm. Falling back: " + se.getMessage());
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerMillis, pendingIntent);
                } else {
                    alarmManager.set(AlarmManager.RTC_WAKEUP, triggerMillis, pendingIntent);
                }
                AlarmStorage.saveAlarm(context, alarm);
                return true;
            } catch (Exception ex) {
                Log.e(TAG, "Failed fallback alarm scheduling: " + ex.getMessage());
                return false;
            }
        } catch (Exception e) {
            Log.e(TAG, "Exception scheduling alarm: " + e.getMessage());
            return false;
        }
    }

    /**
     * Cancels an existing scheduled alarm.
     */
    public static void cancelAlarm(Context context, String alarmId) {
        if (context == null || alarmId == null) return;

        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager != null) {
            Intent intent = new Intent(context, AlarmReceiver.class);
            intent.setAction(ACTION_TRIGGER);
            int reqCode = Math.abs(alarmId.hashCode());
            PendingIntent pendingIntent = PendingIntent.getBroadcast(
                context,
                reqCode,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            try {
                alarmManager.cancel(pendingIntent);
                pendingIntent.cancel();
                Log.i(TAG, "Cancelled alarm id=" + alarmId);
            } catch (Exception e) {
                Log.w(TAG, "Error cancelling alarm: " + e.getMessage());
            }
        }
        AlarmStorage.setAlarmEnabled(context, alarmId, false);
    }

    /**
     * Reschedules all stored enabled alarms (e.g., after device reboot).
     */
    public static void rescheduleAllAlarms(Context context) {
        if (context == null) return;
        List<AlarmStorage.AlarmItem> alarms = AlarmStorage.getAllAlarms(context);
        Log.i(TAG, "Rescheduling " + alarms.size() + " alarms after reboot/restart...");
        long now = System.currentTimeMillis();
        for (AlarmStorage.AlarmItem item : alarms) {
            if (item.enabled) {
                // If past, push forward by 24h
                if (item.triggerMillis <= now) {
                    item.triggerMillis += 24 * 60 * 60 * 1000L;
                }
                scheduleAlarm(context, item);
            }
        }
    }

    /**
     * Parses natural language alarm commands in Hinglish and English.
     * Returns spoken confirmation message or null if not an alarm command.
     */
    public static String parseAndScheduleNaturalAlarm(Context context, String query) {
        if (query == null || context == null) return null;
        String q = query.toLowerCase().trim();

        // 1. Alarm dismissal queries
        if (q.contains("alarm band karo") || q.contains("alarm roko") || q.contains("dismiss alarm") || 
            q.contains("stop alarm") || q.contains("alarm off karo") || q.contains("sare alarm band")) {
            Intent stopIntent = new Intent(context, AlarmRingService.class);
            stopIntent.setAction(AlarmRingService.ACTION_STOP);
            context.startService(stopIntent);
            return "Alarm band kar diya hai.";
        }

        // 2. Alarm query list
        if (q.contains("mere alarm") || q.contains("alarms batao") || q.contains("show alarms") || 
            q.contains("list alarms") || q.contains("kitne alarm")) {
            List<AlarmStorage.AlarmItem> list = AlarmStorage.getAllAlarms(context);
            int activeCount = 0;
            StringBuilder sb = new StringBuilder();
            for (AlarmStorage.AlarmItem item : list) {
                if (item.enabled) {
                    activeCount++;
                    sb.append(item.timeStr).append(", ");
                }
            }
            if (activeCount == 0) {
                return "Abhi koi active alarm set nahi hai.";
            } else {
                String alarmsStr = sb.toString().replaceAll(", $", "");
                return "Aapke " + activeCount + " active alarm hain: " + alarmsStr + ".";
            }
        }

        // 3. Alarm creation check
        boolean isAlarmRequest = q.contains("alarm") || q.contains("utha dena") || q.contains("wake me up") || 
                                 q.contains("jagana") || q.contains("remind me at") || q.contains("baje utha");

        if (!isAlarmRequest) {
            return null;
        }

        try {
            java.util.Calendar cal = java.util.Calendar.getInstance();
            boolean isTomorrow = q.contains("kal") || q.contains("tomorrow");
            boolean isPM = q.contains("pm") || q.contains("shaam") || q.contains("sham") || q.contains("dopahar") || q.contains("raat");
            boolean isAM = q.contains("am") || q.contains("subah") || q.contains("bhor") || q.contains("morning");

            // Check for "in X minutes" / "X minute baad"
            java.util.regex.Pattern minPattern = java.util.regex.Pattern.compile("(\\d+)\\s*(?:minute|min|minto?)\\s*(?:baad|later|me|mein)?");
            java.util.regex.Matcher minMatcher = minPattern.matcher(q);
            if (minMatcher.find()) {
                int mins = Integer.parseInt(minMatcher.group(1));
                long targetTime = System.currentTimeMillis() + (mins * 60 * 1000L);
                cal.setTimeInMillis(targetTime);

                java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("hh:mm a", java.util.Locale.getDefault());
                String timeStr = sdf.format(cal.getTime());

                AlarmStorage.AlarmItem item = new AlarmStorage.AlarmItem();
                item.id = "alarm_" + System.currentTimeMillis();
                item.triggerMillis = targetTime;
                item.timeStr = timeStr;
                item.label = mins + " Minute Timer Alarm";
                item.enabled = true;
                item.sound = true;
                item.vibrate = true;

                scheduleAlarm(context, item);
                return "Theek hai, " + mins + " minute baad (" + timeStr + ") ka alarm laga diya hai.";
            }

            // Time pattern: e.g. "6 baje", "6:30 baje", "6 am", "7:45 pm"
            java.util.regex.Pattern timePattern = java.util.regex.Pattern.compile("(\\d{1,2})(?::(\\d{2}))?\\s*(?:baje|am|pm|o'clock)?");
            java.util.regex.Matcher matcher = timePattern.matcher(q);

            int hour = -1;
            int minute = 0;

            while (matcher.find()) {
                String hStr = matcher.group(1);
                String mStr = matcher.group(2);
                if (hStr != null) {
                    int parsedHour = Integer.parseInt(hStr);
                    if (parsedHour >= 0 && parsedHour <= 24) {
                        hour = parsedHour;
                        if (mStr != null) {
                            minute = Integer.parseInt(mStr);
                        }
                        break;
                    }
                }
            }

            if (hour == -1) {
                return null;
            }

            // Adjust AM/PM
            if (isPM && hour < 12) {
                hour += 12;
            } else if (isAM && hour == 12) {
                hour = 0;
            } else if (!isPM && !isAM) {
                // If neither specified, deduce: if hour < 7, likely morning or tomorrow
                if (hour < 6) {
                    // e.g. 5 baje -> 5 AM
                } else if (hour >= 8 && hour <= 11) {
                    // if currently evening and user says 9 baje, could be tonight 9 PM
                    java.util.Calendar current = java.util.Calendar.getInstance();
                    if (current.get(java.util.Calendar.HOUR_OF_DAY) >= 12 && current.get(java.util.Calendar.HOUR_OF_DAY) < 22) {
                        hour += 12;
                    }
                }
            }

            cal.set(java.util.Calendar.HOUR_OF_DAY, hour);
            cal.set(java.util.Calendar.MINUTE, minute);
            cal.set(java.util.Calendar.SECOND, 0);
            cal.set(java.util.Calendar.MILLISECOND, 0);

            if (isTomorrow || cal.getTimeInMillis() <= System.currentTimeMillis()) {
                cal.add(java.util.Calendar.DAY_OF_YEAR, 1);
            }

            java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("hh:mm a", java.util.Locale.getDefault());
            String formattedTime = sdf.format(cal.getTime());

            AlarmStorage.AlarmItem item = new AlarmStorage.AlarmItem();
            item.id = "alarm_" + System.currentTimeMillis();
            item.triggerMillis = cal.getTimeInMillis();
            item.timeStr = formattedTime;
            item.label = isTomorrow ? "Kal " + formattedTime + " Alarm" : formattedTime + " Alarm";
            item.enabled = true;
            item.sound = true;
            item.vibrate = true;

            boolean ok = scheduleAlarm(context, item);
            if (ok) {
                String dayWord = isTomorrow ? "kal " : "";
                return "Done! " + dayWord + formattedTime + " ka alarm set kar diya hai.";
            } else {
                return "Alarm schedule karne mein dikkat aayi.";
            }
        } catch (Exception e) {
            Log.e(TAG, "Error in natural alarm parser: " + e.getMessage());
            return null;
        }
    }
}
