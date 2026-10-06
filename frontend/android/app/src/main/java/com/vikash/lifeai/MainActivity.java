package com.vikash.lifeai;

import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(HandsFreeVoicePlugin.class);
        registerPlugin(AlarmPlugin.class);
        super.onCreate(savedInstanceState);

        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                WebView webView = getBridge().getWebView();
                WebSettings settings = webView.getSettings();
                settings.setMediaPlaybackRequiresUserGesture(false);
                settings.setDomStorageEnabled(true);
                settings.setJavaScriptEnabled(true);
                settings.setAllowFileAccess(true);
                settings.setAllowContentAccess(true);
                settings.setDatabaseEnabled(true);
                CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
            }
        } catch (Exception ignored) {}
    }

    @Override
    public void onPause() {
        super.onPause();
        try {
            android.content.SharedPreferences prefs = getSharedPreferences("life_ai_prefs", android.content.Context.MODE_PRIVATE);
            boolean bgEnabled = prefs.getBoolean("background_listening_enabled", false);
            if (!bgEnabled) {
                HandsFreeVoiceService.pauseListening(this);
            }
        } catch (Exception ignored) {}
    }

    @Override
    public void onResume() {
        super.onResume();
        try {
            android.content.SharedPreferences prefs = getSharedPreferences("life_ai_prefs", android.content.Context.MODE_PRIVATE);
            boolean handsFreeEnabled = prefs.getBoolean("hands_free_enabled", true);
            if (handsFreeEnabled) {
                HandsFreeVoiceService.resumeListening(this);
            }
        } catch (Exception ignored) {}
    }

    @Override
    public void onDestroy() {
        try {
            android.content.SharedPreferences prefs = getSharedPreferences("life_ai_prefs", android.content.Context.MODE_PRIVATE);
            boolean bgEnabled = prefs.getBoolean("background_listening_enabled", false);
            if (!bgEnabled) {
                HandsFreeVoiceService.pauseListening(this);
            }
        } catch (Exception ignored) {}
        super.onDestroy();
    }
}
