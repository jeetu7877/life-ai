package com.vikash.lifeai;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.util.Log;
import androidx.core.content.ContextCompat;

public class BootReceiver extends BroadcastReceiver {
    private static final String TAG = "LifeAIBootReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent != null ? intent.getAction() : null;
        if (Intent.ACTION_BOOT_COMPLETED.equals(action) || 
            "android.intent.action.QUICKBOOT_POWERON".equals(action) || 
            Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {
            
            Log.i(TAG, "Boot or package update detected: " + action);
            SharedPreferences prefs = context.getSharedPreferences("life_ai_prefs", Context.MODE_PRIVATE);
            boolean isEnabled = prefs.getBoolean("hands_free_enabled", false);

            if (isEnabled) {
                String token = prefs.getString("auth_token", "");
                String serverUrl = prefs.getString("server_url", "https://life-ai-daoh.onrender.com");
                String wakeWord = prefs.getString("wake_word", "Hey Life");
                boolean voiceResponse = prefs.getBoolean("voice_response", true);

                Intent serviceIntent = new Intent(context, HandsFreeVoiceService.class);
                serviceIntent.setAction(HandsFreeVoiceService.ACTION_START);
                serviceIntent.putExtra(HandsFreeVoiceService.EXTRA_SERVER_URL, serverUrl);
                serviceIntent.putExtra(HandsFreeVoiceService.EXTRA_TOKEN, token);
                serviceIntent.putExtra(HandsFreeVoiceService.EXTRA_WAKE_WORD, wakeWord);
                serviceIntent.putExtra(HandsFreeVoiceService.EXTRA_VOICE_RESPONSE, voiceResponse);

                try {
                    ContextCompat.startForegroundService(context, serviceIntent);
                    Log.i(TAG, "HandsFreeVoiceService successfully auto-started after phone boot!");
                } catch (Exception e) {
                    Log.e(TAG, "Failed to auto-start service after boot: " + e.getMessage());
                }
            }
        }
    }
}
