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
                onAssistantResponse(responseText, conversationId, null);
            }

            @Override
            public void onAssistantResponse(String responseText, String conversationId, String toolsExecuted) {
                JSObject ret = new JSObject();
                ret.put("response", responseText);
                ret.put("conversationId", conversationId);
                if (toolsExecuted != null && !toolsExecuted.isEmpty()) {
                    ret.put("toolsExecuted", toolsExecuted);
                }
                notifyListeners("assistantResponse", ret);
            }

            @Override
            public void onRmsChanged(float rmsdB) {
                JSObject ret = new JSObject();
                ret.put("rmsdB", rmsdB);
                notifyListeners("rmsUpdate", ret);
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
    public void checkPermissions(PluginCall call) {
        boolean micGranted = getPermissionState("microphone") == PermissionState.GRANTED;
        boolean notifGranted = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            notifGranted = getPermissionState("notifications") == PermissionState.GRANTED;
        }
        JSObject ret = new JSObject();
        ret.put("microphone", micGranted);
        ret.put("notifications", notifGranted);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestMicPermission(PluginCall call) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
        } else {
            requestPermissionForAlias("microphone", call, "microphonePermCallbackSimple");
        }
    }

    @PermissionCallback
    private void microphonePermCallbackSimple(PluginCall call) {
        boolean granted = getPermissionState("microphone") == PermissionState.GRANTED;
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        call.resolve(ret);
    }

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            Uri uri = Uri.fromParts("package", getContext().getPackageName(), null);
            intent.setData(uri);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to open app settings: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void startHandsFree(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            requestPermissionForAlias("microphone", call, "microphonePermCallback");
            return;
        }

        // On Android 13+, check notifications permission too
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (getPermissionState("notifications") != PermissionState.GRANTED) {
                requestPermissionForAlias("notifications", call, "notificationsPermCallback");
                return;
            }
        }

        startServiceInternal(call);
    }

    @PermissionCallback
    private void microphonePermCallback(PluginCall call) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
                getPermissionState("notifications") != PermissionState.GRANTED) {
                requestPermissionForAlias("notifications", call, "notificationsPermCallback");
            } else {
                startServiceInternal(call);
            }
        } else {
            call.reject("Microphone permission is required for Life AI voice.");
        }
    }

    @PermissionCallback
    private void notificationsPermCallback(PluginCall call) {
        // Start service regardless of notification result (notification permission is optional on older, but good for foreground)
        startServiceInternal(call);
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
    public void triggerListen(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            requestPermissionForAlias("microphone", call, "microphonePermCallbackTriggerListen");
            return;
        }

        HandsFreeVoiceService.triggerListen(getContext());
        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    @PermissionCallback
    private void microphonePermCallbackTriggerListen(PluginCall call) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) {
            HandsFreeVoiceService.triggerListen(getContext());
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } else {
            call.reject("Microphone permission is required for voice conversation.");
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
    public void setMusicPlaying(PluginCall call) {
        boolean playing = call.getBoolean("playing", false);
        if (HandsFreeVoiceService.isRunning()) {
            Intent intent = new Intent(getContext(), HandsFreeVoiceService.class);
            intent.setAction(HandsFreeVoiceService.ACTION_SET_MUSIC_PLAYING);
            intent.putExtra(HandsFreeVoiceService.EXTRA_IS_MUSIC_PLAYING, playing);
            getContext().startService(intent);
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

    @PluginMethod
    public void pauseListening(PluginCall call) {
        try {
            HandsFreeVoiceService.pauseListening(getContext());
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to pause listening: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void resumeListening(PluginCall call) {
        try {
            HandsFreeVoiceService.resumeListening(getContext());
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to resume listening: " + e.getMessage(), e);
        }
    }

    @Override
    protected void handleOnPause() {
        super.handleOnPause();
        try {
            android.content.SharedPreferences prefs = getContext().getSharedPreferences("life_ai_prefs", Context.MODE_PRIVATE);
            boolean bgEnabled = prefs.getBoolean("background_listening_enabled", false);
            if (!bgEnabled) {
                HandsFreeVoiceService.pauseListening(getContext());
            }
        } catch (Exception ignored) {}
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        try {
            android.content.SharedPreferences prefs = getContext().getSharedPreferences("life_ai_prefs", Context.MODE_PRIVATE);
            boolean handsFreeEnabled = prefs.getBoolean("hands_free_enabled", true);
            if (handsFreeEnabled && getPermissionState("microphone") == PermissionState.GRANTED) {
                HandsFreeVoiceService.resumeListening(getContext());
            }
        } catch (Exception ignored) {}
    }

    @Override
    protected void handleOnDestroy() {
        try {
            android.content.SharedPreferences prefs = getContext().getSharedPreferences("life_ai_prefs", Context.MODE_PRIVATE);
            boolean bgEnabled = prefs.getBoolean("background_listening_enabled", false);
            if (!bgEnabled) {
                HandsFreeVoiceService.pauseListening(getContext());
            }
        } catch (Exception ignored) {}
        super.handleOnDestroy();
    }
}
