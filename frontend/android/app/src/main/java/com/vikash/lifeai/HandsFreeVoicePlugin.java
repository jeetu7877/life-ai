package com.vikash.lifeai;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "HandsFreeVoice",
    permissions = {
        @Permission(
            alias = "microphone",
            strings = { Manifest.permission.RECORD_AUDIO }
        ),
        @Permission(
            alias = "notifications",
            strings = { Manifest.permission.POST_NOTIFICATIONS }
        )
    }
)
public class HandsFreeVoicePlugin extends Plugin {
    private static final String TAG = "HandsFreeVoicePlugin";

    @Override
    public void load() {
        super.load();
        HandsFreeVoiceService.setEventListener(new HandsFreeVoiceService.ServiceEventListener() {
            @Override
            public void onStateChanged(HandsFreeVoiceService.State newState) {
                JSObject ret = new JSObject();
                ret.put("state", newState.name().toLowerCase());
                notifyListeners("voiceStateChanged", ret);
            }

            @Override
            public void onTranscript(String text, boolean isFinal) {
                JSObject ret = new JSObject();
                ret.put("transcript", text);
                ret.put("isFinal", isFinal);
                notifyListeners("transcriptUpdate", ret);
            }

            @Override
            public void onAssistantResponse(String responseText, String conversationId) {
                JSObject ret = new JSObject();
                ret.put("response", responseText);
                ret.put("conversationId", conversationId);
                notifyListeners("assistantResponse", ret);
            }

            @Override
            public void onError(String errorMessage) {
                JSObject ret = new JSObject();
                ret.put("error", errorMessage);
                notifyListeners("voiceError", ret);
            }
        });
    }

    @PluginMethod
    public void startHandsFree(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            requestPermissionForAlias("microphone", call, "microphonePermCallback");
            return;
        }

        startServiceInternal(call);
    }

    @PermissionCallback
    private void microphonePermCallback(PluginCall call) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) {
            startServiceInternal(call);
        } else {
            call.reject("Microphone permission is required for Hey Life.");
        }
    }

    private void startServiceInternal(PluginCall call) {
        try {
            String serverUrl = call.getString("serverUrl", "https://life-ai-daoh.onrender.com");
            String token = call.getString("token", "");
            String wakeWord = call.getString("wakeWord", "Hey Life");
            boolean voiceResponse = call.getBoolean("voiceResponse", true);

            Intent serviceIntent = new Intent(getContext(), HandsFreeVoiceService.class);
            serviceIntent.setAction(HandsFreeVoiceService.ACTION_START);
            serviceIntent.putExtra(HandsFreeVoiceService.EXTRA_SERVER_URL, serverUrl);
            serviceIntent.putExtra(HandsFreeVoiceService.EXTRA_TOKEN, token);
            serviceIntent.putExtra(HandsFreeVoiceService.EXTRA_WAKE_WORD, wakeWord);
            serviceIntent.putExtra(HandsFreeVoiceService.EXTRA_VOICE_RESPONSE, voiceResponse);

            ContextCompat.startForegroundService(getContext(), serviceIntent);

            android.content.SharedPreferences prefs = getContext().getSharedPreferences("life_ai_prefs", android.content.Context.MODE_PRIVATE);
            prefs.edit()
                .putBoolean("hands_free_enabled", true)
                .putString("server_url", serverUrl)
                .putString("auth_token", token)
                .putString("wake_word", wakeWord)
                .putBoolean("voice_response", voiceResponse)
                .apply();

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("running", true);
            ret.put("wakeWord", wakeWord);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to start Hands-Free Voice service: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void stopHandsFree(PluginCall call) {
        try {
            Intent stopIntent = new Intent(getContext(), HandsFreeVoiceService.class);
            stopIntent.setAction(HandsFreeVoiceService.ACTION_STOP);
            getContext().startService(stopIntent);

            android.content.SharedPreferences prefs = getContext().getSharedPreferences("life_ai_prefs", android.content.Context.MODE_PRIVATE);
            prefs.edit().putBoolean("hands_free_enabled", false).apply();

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("running", false);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to stop Hands-Free Voice service: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void isHandsFreeRunning(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("running", HandsFreeVoiceService.isRunning());
        ret.put("state", HandsFreeVoiceService.getCurrentState().name().toLowerCase());
        call.resolve(ret);
    }

    @PluginMethod
    public void updateAuth(PluginCall call) {
        String token = call.getString("token", "");
        String serverUrl = call.getString("serverUrl", "");

        if (HandsFreeVoiceService.isRunning()) {
            Intent updateIntent = new Intent(getContext(), HandsFreeVoiceService.class);
            updateIntent.setAction(HandsFreeVoiceService.ACTION_START);
            if (!token.isEmpty()) updateIntent.putExtra(HandsFreeVoiceService.EXTRA_TOKEN, token);
            if (!serverUrl.isEmpty()) updateIntent.putExtra(HandsFreeVoiceService.EXTRA_SERVER_URL, serverUrl);
            getContext().startService(updateIntent);
        }

        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void checkBatteryOptimization(PluginCall call) {
        try {
            boolean isIgnoring = true;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
                if (pm != null) {
                    isIgnoring = pm.isIgnoringBatteryOptimizations(getContext().getPackageName());
                }
            }
            JSObject ret = new JSObject();
            ret.put("isIgnoringBatteryOptimizations", isIgnoring);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to check battery optimization: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void requestIgnoreBatteryOptimization(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
                if (pm != null && !pm.isIgnoringBatteryOptimizations(getContext().getPackageName())) {
                    Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                    intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getContext().startActivity(intent);
                }
            }
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to request battery optimization: " + e.getMessage(), e);
        }
    }
}
