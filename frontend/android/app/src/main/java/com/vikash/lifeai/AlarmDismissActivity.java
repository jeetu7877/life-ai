package com.vikash.lifeai;

import android.app.Activity;
import android.app.KeyguardManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class AlarmDismissActivity extends Activity {
    private String alarmId;
    private String alarmLabel;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Turn screen on and show over keyguard/lock screen
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
            KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
            if (km != null) {
                km.requestDismissKeyguard(this, null);
            }
        } else {
            getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD |
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON |
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            );
        }

        alarmId = getIntent().getStringExtra("alarm_id");
        alarmLabel = getIntent().getStringExtra("alarm_label");
        if (alarmLabel == null || alarmLabel.isEmpty()) {
            alarmLabel = "Life AI Alarm";
        }

        // Programmatic sleek dark mode UI matching Life AI theme
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setBackgroundColor(Color.parseColor("#05070B"));
        root.setPadding(64, 96, 64, 96);

        // Glowing Alarm Icon
        TextView iconView = new TextView(this);
        iconView.setText("⏰");
        iconView.setTextSize(64);
        iconView.setGravity(Gravity.CENTER);
        root.addView(iconView);

        // Time display
        SimpleDateFormat timeFormat = new SimpleDateFormat("hh:mm a", Locale.getDefault());
        TextView timeView = new TextView(this);
        timeView.setText(timeFormat.format(new Date()));
        timeView.setTextSize(48);
        timeView.setTypeface(Typeface.DEFAULT_BOLD);
        timeView.setTextColor(Color.parseColor("#38BDF8")); // Cyan/blue
        timeView.setGravity(Gravity.CENTER);
        timeView.setPadding(0, 32, 0, 16);
        root.addView(timeView);

        // Label display
        TextView labelView = new TextView(this);
        labelView.setText(alarmLabel);
        labelView.setTextSize(22);
        labelView.setTextColor(Color.parseColor("#F8FAFC"));
        labelView.setGravity(Gravity.CENTER);
        labelView.setPadding(0, 0, 0, 96);
        root.addView(labelView);

        // Buttons container
        LinearLayout buttonBox = new LinearLayout(this);
        buttonBox.setOrientation(LinearLayout.VERTICAL);
        buttonBox.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams boxParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        buttonBox.setLayoutParams(boxParams);

        // Snooze Button
        Button snoozeBtn = new Button(this);
        snoozeBtn.setText("Snooze (5 Min)");
        snoozeBtn.setTextSize(18);
        snoozeBtn.setTextColor(Color.WHITE);
        snoozeBtn.setBackgroundColor(Color.parseColor("#1E293B"));
        snoozeBtn.setPadding(32, 36, 32, 36);
        LinearLayout.LayoutParams snoozeParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        snoozeParams.setMargins(0, 0, 0, 24);
        snoozeBtn.setLayoutParams(snoozeParams);
        snoozeBtn.setOnClickListener(v -> handleSnooze());
        buttonBox.addView(snoozeBtn);

        // Dismiss Button
        Button dismissBtn = new Button(this);
        dismissBtn.setText("Dismiss Alarm");
        dismissBtn.setTextSize(18);
        dismissBtn.setTextColor(Color.WHITE);
        dismissBtn.setBackgroundColor(Color.parseColor("#DC2626")); // Red
        dismissBtn.setPadding(32, 36, 32, 36);
        dismissBtn.setLayoutParams(new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ));
        dismissBtn.setOnClickListener(v -> handleDismiss());
        buttonBox.addView(dismissBtn);

        root.addView(buttonBox);
        setContentView(root);
    }

    private void handleDismiss() {
        Intent stopIntent = new Intent(this, AlarmRingService.class);
        stopIntent.setAction(AlarmRingService.ACTION_STOP);
        startService(stopIntent);

        if (alarmId != null) {
            AlarmStorage.setAlarmEnabled(this, alarmId, false);
        }
        finish();
    }

    private void handleSnooze() {
        Intent stopIntent = new Intent(this, AlarmRingService.class);
        stopIntent.setAction(AlarmRingService.ACTION_STOP);
        startService(stopIntent);

        long snoozeTrigger = System.currentTimeMillis() + (5 * 60 * 1000L);
        AlarmStorage.AlarmItem item = AlarmStorage.getAlarmById(this, alarmId);
        if (item != null) {
            item.triggerMillis = snoozeTrigger;
            item.enabled = true;
            AlarmEngine.scheduleAlarm(this, item);
        } else {
            AlarmStorage.AlarmItem snoozed = new AlarmStorage.AlarmItem();
            snoozed.id = "snooze_" + System.currentTimeMillis();
            snoozed.triggerMillis = snoozeTrigger;
            snoozed.timeStr = "Snoozed (+5m)";
            snoozed.label = alarmLabel;
            snoozed.enabled = true;
            snoozed.vibrate = true;
            snoozed.sound = true;
            AlarmEngine.scheduleAlarm(this, snoozed);
        }
        finish();
    }
}
