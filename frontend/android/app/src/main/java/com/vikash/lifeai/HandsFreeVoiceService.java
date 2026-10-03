package com.vikash.lifeai;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.util.Log;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONObject;

public class HandsFreeVoiceService extends Service {
    private static final String TAG = "HandsFreeVoiceService";
    private static final String CHANNEL_ID = "life_hands_free_channel";
    private static final int NOTIFICATION_ID = 24103;

    public static final String ACTION_START = "com.vikash.lifeai.action.START_HANDS_FREE";
    public static final String ACTION_STOP = "com.vikash.lifeai.action.STOP_HANDS_FREE";
    public static final String EXTRA_SERVER_URL = "extra_server_url";
    public static final String EXTRA_TOKEN = "extra_token";
    public static final String EXTRA_WAKE_WORD = "extra_wake_word";
    public static final String EXTRA_VOICE_RESPONSE = "extra_voice_response";

    public enum State {
        IDLE,
        WAKE_DETECTED,
        LISTENING,
        PROCESSING,
        SPEAKING,
        COOLDOWN
    }

    private static volatile boolean isServiceRunning = false;
    private static volatile State currentState = State.IDLE;
    private static ServiceEventListener eventListener = null;

    public interface ServiceEventListener {
        void onStateChanged(State newState);
        void onTranscript(String text, boolean isFinal);
        void onAssistantResponse(String responseText, String conversationId);
        void onError(String errorMessage);
    }

    public static void setEventListener(ServiceEventListener listener) {
        eventListener = listener;
    }

    public static boolean isRunning() {
        return isServiceRunning;
    }

    public static State getCurrentState() {
        return currentState;
    }

    private String serverUrl = "https://life-ai-daoh.onrender.com";
    private String authToken = "";
    private String wakeWord = "Hey Life";
    private boolean voiceResponseEnabled = true;
    private String activeConversationId = null;

    private SpeechRecognizer speechRecognizer;
    private TextToSpeech textToSpeech;
    private boolean ttsReady = false;
    private PowerManager.WakeLock wakeLock;
    private Handler mainHandler;
    private ExecutorService networkExecutor;

    private Runnable silenceTimeoutRunnable;
    private static final long SILENCE_TIMEOUT_MS = 8000;
    private static final long RESTART_DELAY_MS = 350;

    @Override
    public void onCreate() {
        super.onCreate();
        mainHandler = new Handler(Looper.getMainLooper());
        networkExecutor = Executors.newSingleThreadExecutor();

        createNotificationChannel();
        acquireWakeLock();
        initTTS();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String action = intent.getAction();
            if (ACTION_STOP.equals(action)) {
                Log.i(TAG, "Stop action received in onStartCommand");
                stopSelf();
                return START_NOT_STICKY;
            }

            if (intent.hasExtra(EXTRA_SERVER_URL)) {
                serverUrl = intent.getStringExtra(EXTRA_SERVER_URL);
            }
            if (intent.hasExtra(EXTRA_TOKEN)) {
                authToken = intent.getStringExtra(EXTRA_TOKEN);
            }
            if (intent.hasExtra(EXTRA_WAKE_WORD)) {
                wakeWord = intent.getStringExtra(EXTRA_WAKE_WORD);
            }
            if (intent.hasExtra(EXTRA_VOICE_RESPONSE)) {
                voiceResponseEnabled = intent.getBooleanExtra(EXTRA_VOICE_RESPONSE, true);
            }
        }

        Notification notification = buildNotification("Life is listening for '" + wakeWord + "'");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }

        isServiceRunning = true;
        setState(State.IDLE);

        mainHandler.post(this::initAndStartSpeechRecognizer);
        return START_STICKY;
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        isServiceRunning = false;
        setState(State.IDLE);

        mainHandler.removeCallbacksAndMessages(null);

        if (speechRecognizer != null) {
            try {
                speechRecognizer.destroy();
            } catch (Exception e) {
                Log.w(TAG, "Error destroying speech recognizer: " + e.getMessage());
            }
            speechRecognizer = null;
        }

        if (textToSpeech != null) {
            try {
                textToSpeech.stop();
                textToSpeech.shutdown();
            } catch (Exception e) {
                Log.w(TAG, "Error shutting down TTS: " + e.getMessage());
            }
            textToSpeech = null;
        }

        if (networkExecutor != null) {
            networkExecutor.shutdownNow();
        }

        releaseWakeLock();
        stopForeground(true);
        Log.i(TAG, "HandsFreeVoiceService stopped cleanly");
    }

    // ==================== STATE MANAGEMENT ====================

    private void setState(State newState) {
        currentState = newState;
        Log.i(TAG, "[VOICE_STATE] " + newState);
        updateNotificationForState(newState);

        if (eventListener != null) {
            mainHandler.post(() -> {
                if (eventListener != null) {
                    eventListener.onStateChanged(newState);
                }
            });
        }
    }

    // ==================== TTS INITIALIZATION ====================

    private void initTTS() {
        textToSpeech = new TextToSpeech(this, status -> {
            if (status == TextToSpeech.SUCCESS) {
                ttsReady = true;
                // Prefer Indian Hindi or Indian English
                Locale hindiLocale = new Locale("hi", "IN");
                int res = textToSpeech.setLanguage(hindiLocale);
                if (res == TextToSpeech.LANG_MISSING_DATA || res == TextToSpeech.LANG_NOT_SUPPORTED) {
                    textToSpeech.setLanguage(new Locale("en", "IN"));
                }
                textToSpeech.setSpeechRate(0.95f);
                textToSpeech.setPitch(1.05f);

                textToSpeech.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                    @Override
                    public void onStart(String utteranceId) {
                        Log.d(TAG, "TTS onStart: " + utteranceId);
                    }

                    @Override
                    public void onDone(String utteranceId) {
                        Log.d(TAG, "TTS onDone: " + utteranceId);
                        mainHandler.post(() -> onSpeakingCompleted(utteranceId));
                    }

                    @Override
                    public void onError(String utteranceId) {
                        Log.w(TAG, "TTS onError: " + utteranceId);
                        mainHandler.post(() -> onSpeakingCompleted(utteranceId));
                    }
                });
            } else {
                Log.e(TAG, "TTS initialization failed: " + status);
            }
        });
    }

    private void speakText(String text, String utteranceId) {
        if (!voiceResponseEnabled || !ttsReady || textToSpeech == null) {
            onSpeakingCompleted(utteranceId);
            return;
        }

        setState(State.SPEAKING);
        stopListeningTemporarily();

        String cleaned = cleanSpeechText(text);
        Bundle params = new Bundle();
        params.putString(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, utteranceId);
        textToSpeech.speak(cleaned, TextToSpeech.QUEUE_FLUSH, params, utteranceId);
    }

    private void onSpeakingCompleted(String utteranceId) {
        if ("wake_greeting".equals(utteranceId)) {
            // Wake greeting finished ("Haan, bolo."), now listen for user's question!
            setState(State.LISTENING);
            startListeningForQuery();
        } else {
            // Answer finished. Enter follow-up conversation window!
            setState(State.COOLDOWN);
            startFollowUpWindow();
        }
    }

    // ==================== SPEECH RECOGNITION ====================

    private void initAndStartSpeechRecognizer() {
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            Log.e(TAG, "SpeechRecognizer is NOT available on this device!");
            if (eventListener != null) {
                eventListener.onError("Speech recognition not available on device");
            }
            return;
        }

        if (speechRecognizer != null) {
            try {
                speechRecognizer.destroy();
            } catch (Exception ignored) {}
        }

        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this);
        speechRecognizer.setRecognitionListener(new RecognitionListener() {
            @Override
            public void onReadyForSpeech(Bundle params) {
                Log.d(TAG, "onReadyForSpeech state=" + currentState);
            }

            @Override
            public void onBeginningOfSpeech() {
                Log.d(TAG, "onBeginningOfSpeech");
                cancelSilenceTimer();
            }

            @Override
            public void onRmsChanged(float rmsdB) {}

            @Override
            public void onBufferReceived(byte[] buffer) {}

            @Override
            public void onEndOfSpeech() {
                Log.d(TAG, "onEndOfSpeech state=" + currentState);
            }

            @Override
            public void onError(int error) {
                Log.d(TAG, "SpeechRecognizer onError code: " + error + " state=" + currentState);
                handleSpeechError(error);
            }

            @Override
            public void onResults(Bundle results) {
                handleSpeechResults(results, true);
            }

            @Override
            public void onPartialResults(Bundle partialResults) {
                handleSpeechResults(partialResults, false);
            }

            @Override
            public void onEvent(int eventType, Bundle params) {}
        });

        startListeningLoop();
    }

    private void startListeningLoop() {
        if (speechRecognizer == null || currentState == State.SPEAKING || currentState == State.PROCESSING) {
            return;
        }

        try {
            Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-IN");
            intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
            intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3);
            intent.putExtra("android.speech.extra.DICTATION_MODE", true);

            speechRecognizer.startListening(intent);
        } catch (Exception e) {
            Log.w(TAG, "startListening error: " + e.getMessage());
            scheduleRestartListening(RESTART_DELAY_MS);
        }
    }

    private void stopListeningTemporarily() {
        if (speechRecognizer != null) {
            try {
                speechRecognizer.stopListening();
                speechRecognizer.cancel();
            } catch (Exception ignored) {}
        }
    }

    private void handleSpeechResults(Bundle bundle, boolean isFinal) {
        if (bundle == null) return;
        ArrayList<String> matches = bundle.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        if (matches == null || matches.isEmpty()) return;

        String recognizedText = matches.get(0).trim();
        if (recognizedText.isEmpty()) return;

        Log.d(TAG, "SpeechResult (isFinal=" + isFinal + ", state=" + currentState + "): " + recognizedText);

        if (eventListener != null) {
            mainHandler.post(() -> eventListener.onTranscript(recognizedText, isFinal));
        }

        // 1. In IDLE or COOLDOWN: Listen for Wake Word ("Hey Life" / "Life" / "Jeet")
        if (currentState == State.IDLE) {
            if (isWakeWordMatch(recognizedText)) {
                onWakeWordDetected();
            }
        }
        // 2. In LISTENING or active follow-up: Capture User's Query
        else if (currentState == State.LISTENING || currentState == State.COOLDOWN) {
            if (isFinal) {
                cancelSilenceTimer();
                // Filter out accidental wake word repeat
                if (isWakeWordOnly(recognizedText)) {
                    speakText("Haan, bolo.", "wake_greeting");
                    return;
                }
                processUserQuery(recognizedText);
            } else {
                // If user starts speaking in follow-up, reset silence timer
                resetSilenceTimer();
            }
        }
    }

    private void handleSpeechError(int error) {
        if (currentState == State.SPEAKING || currentState == State.PROCESSING) {
            return;
        }

        if (currentState == State.LISTENING || currentState == State.COOLDOWN) {
            // If in active query mode and error is NO_MATCH / TIMEOUT, trigger silence timeout
            if (error == SpeechRecognizer.ERROR_NO_MATCH || error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT) {
                // Let silence timer handle return to IDLE
                return;
            }
        }

        // Restart listener in IDLE state after small backoff
        scheduleRestartListening(RESTART_DELAY_MS);
    }

    private void scheduleRestartListening(long delayMs) {
        mainHandler.postDelayed(() -> {
            if (isServiceRunning && currentState != State.SPEAKING && currentState != State.PROCESSING) {
                startListeningLoop();
            }
        }, delayMs);
    }

    // ==================== WAKE WORD DETECTION ====================

    private boolean isWakeWordMatch(String text) {
        if (text == null) return false;
        String lower = text.toLowerCase().trim();

        // Check configured wake word (default: "Hey Life")
        String customWake = wakeWord != null ? wakeWord.toLowerCase().trim() : "hey life";
        if (lower.contains(customWake)) return true;

        // Built-in variations for Indian speech / phonetic variants
        return lower.contains("hey life") ||
               lower.contains("life") ||
               lower.contains("lyf") ||
               lower.contains("hello life") ||
               lower.contains("ok life") ||
               lower.contains("hey jeet") ||
               lower.contains("jeet") ||
               lower.contains("हे लाइफ") ||
               lower.contains("लाइफ") ||
               lower.contains("जीत");
    }

    private boolean isWakeWordOnly(String text) {
        if (text == null) return false;
        String lower = text.toLowerCase().trim();
        return lower.equals("hey life") || lower.equals("life") || lower.equals("jeet") || lower.equals("hey jeet");
    }

    private void onWakeWordDetected() {
        Log.i(TAG, ">>> LOCAL WAKE WORD DETECTED! Triggering assistant greeting.");
        setState(State.WAKE_DETECTED);
        cancelSilenceTimer();

        // Speak "Haan, bolo."
        speakText("Haan, bolo.", "wake_greeting");
    }

    private void startListeningForQuery() {
        resetSilenceTimer();
        startListeningLoop();
    }

    private void startFollowUpWindow() {
        // Follow-up conversation: allows user to ask another question without saying "Hey Life" again
        resetSilenceTimer();
        startListeningLoop();
    }

    private void resetSilenceTimer() {
        cancelSilenceTimer();
        silenceTimeoutRunnable = () -> {
            Log.i(TAG, "Silence timeout reached (8s). Transitioning back to IDLE.");
            setState(State.IDLE);
            activeConversationId = null;
            scheduleRestartListening(100);
        };
        mainHandler.postDelayed(silenceTimeoutRunnable, SILENCE_TIMEOUT_MS);
    }

    private void cancelSilenceTimer() {
        if (silenceTimeoutRunnable != null) {
            mainHandler.removeCallbacks(silenceTimeoutRunnable);
            silenceTimeoutRunnable = null;
        }
    }

    // ==================== BACKEND INTEGRATION ====================

    private void processUserQuery(String userQuery) {
        setState(State.PROCESSING);
        stopListeningTemporarily();

        networkExecutor.execute(() -> {
            try {
                String cleanBase = serverUrl != null ? serverUrl.replaceAll("/+$", "") : "https://life-ai-daoh.onrender.com";
                String endpoint = cleanBase + "/api/v1/chat";

                JSONObject payload = new JSONObject();
                payload.put("content", userQuery);
                payload.put("timezone", "Asia/Kolkata");
                payload.put("voice_mode", true);
                if (activeConversationId != null && !activeConversationId.isEmpty()) {
                    payload.put("conversation_id", activeConversationId);
                }

                URL url = new URL(endpoint);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
                conn.setRequestProperty("Accept", "application/json");
                if (authToken != null && !authToken.trim().isEmpty()) {
                    conn.setRequestProperty("Authorization", "Bearer " + authToken.trim());
                }
                conn.setConnectTimeout(20000);
                conn.setReadTimeout(30000);
                conn.setDoOutput(true);

                byte[] postData = payload.toString().getBytes(StandardCharsets.UTF_8);
                try (OutputStream os = conn.getOutputStream()) {
                    os.write(postData);
                }

                int responseCode = conn.getResponseCode();
                if (responseCode == 200) {
                    BufferedReader in = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8));
                    StringBuilder sb = new StringBuilder();
                    String line;
                    while ((line = in.readLine()) != null) {
                        sb.append(line);
                    }
                    in.close();

                    JSONObject resObj = new JSONObject(sb.toString());
                    String answer = resObj.optString("response", "Maine aapki baat samajh li hai.");
                    activeConversationId = resObj.optString("conversation_id", activeConversationId);

                    Log.i(TAG, "Backend Response received: " + answer);

                    mainHandler.post(() -> {
                        if (eventListener != null) {
                            eventListener.onAssistantResponse(answer, activeConversationId);
                        }
                        speakText(answer, "query_answer");
                    });
                } else if (responseCode == 401 || responseCode == 403) {
                    Log.w(TAG, "Authentication failure from backend (HTTP " + responseCode + ")");
                    mainHandler.post(() -> {
                        speakText("Kripya pehle app me login karein.", "auth_error");
                        if (eventListener != null) eventListener.onError("Authentication required");
                    });
                } else {
                    Log.w(TAG, "Backend server error HTTP " + responseCode);
                    mainHandler.post(() -> {
                        speakText("Abhi Life server se connection nahi ho raha.", "server_error");
                        if (eventListener != null) eventListener.onError("Backend HTTP " + responseCode);
                    });
                }
            } catch (java.net.UnknownHostException e) {
                Log.e(TAG, "No internet / DNS failure: " + e.getMessage());
                mainHandler.post(() -> {
                    speakText("Internet connection nahi hai.", "network_error");
                    if (eventListener != null) eventListener.onError("No internet connection");
                });
            } catch (java.net.SocketTimeoutException e) {
                Log.e(TAG, "Server timeout: " + e.getMessage());
                mainHandler.post(() -> {
                    speakText("Response lene mein thoda problem aa raha hai.", "timeout_error");
                    if (eventListener != null) eventListener.onError("Request timed out");
                });
            } catch (Exception e) {
                Log.e(TAG, "Query processing exception: " + e.getMessage(), e);
                mainHandler.post(() -> {
                    speakText("Kshama kijiye, mujhe response process karne mein dikkat aayi.", "generic_error");
                    if (eventListener != null) eventListener.onError(e.getMessage());
                });
            }
        });
    }

    // ==================== TEXT CLEANING HELPER ====================

    private String cleanSpeechText(String text) {
        if (text == null) return "";
        // Strip markdown links [text](url) -> text
        String cleaned = text.replaceAll("\\[([^\\]]+)\\]\\([^)]+\\)", "$1");
        // Strip asterisks, bold, italics, backticks, hashes
        cleaned = cleaned.replaceAll("[*_#`~]", "");
        // Strip markdown bullets
        cleaned = cleaned.replaceAll("(?m)^\\s*[-•*]\\s+", "");
        // Normalize whitespaces
        cleaned = cleaned.replaceAll("\\s+", " ").trim();
        return cleaned;
    }

    // ==================== NOTIFICATION & WAKELOCK ====================

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Life Voice Assistant",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Background voice service listening for 'Hey Life'");
            channel.setShowBadge(false);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) {
                nm.createNotificationChannel(channel);
            }
        }
    }

    private Notification buildNotification(String contentText) {
        Intent stopIntent = new Intent(this, HandsFreeVoiceService.class);
        stopIntent.setAction(ACTION_STOP);
        PendingIntent stopPendingIntent = PendingIntent.getService(
            this,
            0,
            stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        Intent openAppIntent = new Intent(this, MainActivity.class);
        openAppIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent openAppPending = PendingIntent.getActivity(
            this,
            1,
            openAppIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Life AI Hands-Free Active")
            .setContentText(contentText)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentIntent(openAppPending)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Stop", stopPendingIntent);

        return builder.build();
    }

    private void updateNotificationForState(State state) {
        String msg;
        switch (state) {
            case LISTENING:
                msg = "Listening to you...";
                break;
            case PROCESSING:
                msg = "Thinking & searching memories...";
                break;
            case SPEAKING:
                msg = "Life is speaking...";
                break;
            case COOLDOWN:
                msg = "Follow-up active (Say your next question)...";
                break;
            case WAKE_DETECTED:
                msg = "Wake word detected!";
                break;
            case IDLE:
            default:
                msg = "Say '" + wakeWord + "' anytime";
                break;
        }

        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.notify(NOTIFICATION_ID, buildNotification(msg));
        }
    }

    private void acquireWakeLock() {
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "LifeAI:HandsFreeWakeLock");
                wakeLock.acquire(10 * 60 * 60 * 1000L); // 10 hours safety cap
            }
        } catch (Exception e) {
            Log.w(TAG, "Could not acquire WakeLock: " + e.getMessage());
        }
    }

    private void releaseWakeLock() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
            }
        } catch (Exception ignored) {}
    }
}
