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
    public static final String EXTRA_SILENCE_TIMEOUT = "extra_silence_timeout";

    public enum State {
        STOPPED,
        WAKE_LISTENING,
        WAKE_DETECTED,
        GREETING,
        USER_LISTENING,
        PROCESSING,
        TTS,
        COOLDOWN,
        ERROR
    }

    private static volatile boolean isServiceRunning = false;
    private static volatile State currentState = State.STOPPED;
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
    private long silenceTimeoutMs = 8000;
    private String activeConversationId = null;

    private SpeechRecognizer speechRecognizer;
    private boolean isListeningActive = false;
    private int consecutiveErrorCount = 0;
    private long stateEntryTimestamp = 0;

    private TextToSpeech textToSpeech;
    private boolean ttsReady = false;
    private PowerManager.WakeLock wakeLock;
    private Handler mainHandler;
    private ExecutorService networkExecutor;

    private Runnable silenceTimeoutRunnable;
    private Runnable watchdogRunnable;
    private Runnable stateTimeoutRunnable;

    private static final long WATCHDOG_INTERVAL_MS = 15000;
    private static final long GREETING_TIMEOUT_MS = 4000;
    private static final long PROCESSING_TIMEOUT_MS = 35000;
    private static final long TTS_MAX_TIMEOUT_MS = 60000;

    @Override
    public void onCreate() {
        super.onCreate();
        mainHandler = new Handler(Looper.getMainLooper());
        networkExecutor = Executors.newSingleThreadExecutor();

        createNotificationChannel();
        acquireWakeLock();
        initTTS();
        startWatchdog();

        Log.i(TAG, "[VOICE] service_started");
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String action = intent.getAction();
            if (ACTION_STOP.equals(action)) {
                Log.i(TAG, "[VOICE] service_stopped (via ACTION_STOP)");
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
            if (intent.hasExtra(EXTRA_SILENCE_TIMEOUT)) {
                int secs = intent.getIntExtra(EXTRA_SILENCE_TIMEOUT, 8);
                silenceTimeoutMs = Math.max(4000, secs * 1000L);
            }
        }

        Notification notification = buildNotification("Life AI is listening for '" + wakeWord + "'");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }

        isServiceRunning = true;

        // Single-service guard: If already in WAKE_LISTENING and active, do not recreate listener
        if (currentState == State.WAKE_LISTENING && isListeningActive && speechRecognizer != null) {
            Log.d(TAG, "Service start requested while already in WAKE_LISTENING. Ignoring duplicate init.");
            return START_STICKY;
        }

        setState(State.WAKE_LISTENING);
        consecutiveErrorCount = 0;
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
        setState(State.STOPPED);

        Log.i(TAG, "[VOICE] service_stopped");
        Log.i(TAG, "[VOICE] wake_listener_stopped");

        stopWatchdog();
        cancelAllTimers();

        destroySpeechRecognizer();

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
    }

    // ==================== STATE MANAGEMENT ====================

    private synchronized void setState(State newState) {
        currentState = newState;
        stateEntryTimestamp = System.currentTimeMillis();
        Log.i(TAG, "[VOICE_STATE] " + newState);

        updateNotificationForState(newState);
        setupStateTimeout(newState);

        if (eventListener != null) {
            mainHandler.post(() -> {
                if (eventListener != null) {
                    eventListener.onStateChanged(newState);
                }
            });
        }
    }

    private void setupStateTimeout(State state) {
        if (stateTimeoutRunnable != null) {
            mainHandler.removeCallbacks(stateTimeoutRunnable);
            stateTimeoutRunnable = null;
        }

        long timeout = 0;
        switch (state) {
            case GREETING:
                timeout = GREETING_TIMEOUT_MS;
                break;
            case PROCESSING:
                timeout = PROCESSING_TIMEOUT_MS;
                break;
            case TTS:
                timeout = TTS_MAX_TIMEOUT_MS;
                break;
            default:
                break;
        }

        if (timeout > 0) {
            final long finalTimeout = timeout;
            stateTimeoutRunnable = () -> {
                Log.w(TAG, "State " + state + " timed out after " + finalTimeout + "ms! Recovering to WAKE_LISTENING.");
                if (state == State.GREETING) {
                    // If greeting timed out, transition to user listening
                    setState(State.USER_LISTENING);
                    startListeningForQuery();
                } else {
                    // For processing or TTS hang, safely reset to wake listening
                    setState(State.WAKE_LISTENING);
                    scheduleRestartListening(200);
                }
            };
            mainHandler.postDelayed(stateTimeoutRunnable, timeout);
        }
    }

    // ==================== TTS & LOCAL GREETING ====================

    private void initTTS() {
        textToSpeech = new TextToSpeech(this, status -> {
            if (status == TextToSpeech.SUCCESS) {
                ttsReady = true;
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
                        Log.i(TAG, "[VOICE] tts_started id=" + utteranceId);
                    }

                    @Override
                    public void onDone(String utteranceId) {
                        Log.i(TAG, "[VOICE] tts_finished id=" + utteranceId);
                        mainHandler.post(() -> onSpeakingCompleted(utteranceId));
                    }

                    @Override
                    public void onError(String utteranceId) {
                        Log.w(TAG, "[VOICE] tts_error id=" + utteranceId);
                        mainHandler.post(() -> onSpeakingCompleted(utteranceId));
                    }
                });
            } else {
                Log.e(TAG, "Local TextToSpeech initialization failed with status: " + status);
            }
        });
    }

    private void speakText(String text, String utteranceId) {
        if (!voiceResponseEnabled || !ttsReady || textToSpeech == null) {
            onSpeakingCompleted(utteranceId);
            return;
        }

        stopListeningTemporarily();

        if ("wake_greeting".equals(utteranceId)) {
            setState(State.GREETING);
        } else {
            setState(State.TTS);
        }

        String cleaned = cleanSpeechText(text);
        Bundle params = new Bundle();
        params.putString(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, utteranceId);
        textToSpeech.speak(cleaned, TextToSpeech.QUEUE_FLUSH, params, utteranceId);
    }

    private void onSpeakingCompleted(String utteranceId) {
        if ("wake_greeting".equals(utteranceId)) {
            // Local greeting ("Haan, bolo.") completed!
            // Transition to USER_LISTENING and listen for the question
            Log.i(TAG, "[VOICE] speech_started (awaiting user question)");
            setState(State.USER_LISTENING);
            startListeningForQuery();
        } else {
            // Answer TTS completed! Transition to COOLDOWN (follow-up conversation window)
            setState(State.COOLDOWN);
            startFollowUpWindow();
        }
    }

    // ==================== SPEECH RECOGNITION ====================

    private void initAndStartSpeechRecognizer() {
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            Log.e(TAG, "[VOICE] microphone_error: SpeechRecognizer not available on device");
            setState(State.ERROR);
            if (eventListener != null) {
                eventListener.onError("Speech recognition not available on device");
            }
            return;
        }

        destroySpeechRecognizer();

        try {
            speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this);
            Log.i(TAG, "[VOICE] microphone_initialized");
        } catch (Exception e) {
            Log.e(TAG, "[VOICE] microphone_error: " + e.getMessage());
            scheduleRestartListening(1000);
            return;
        }

        speechRecognizer.setRecognitionListener(new RecognitionListener() {
            @Override
            public void onReadyForSpeech(Bundle params) {
                isListeningActive = true;
                consecutiveErrorCount = 0;
            }

            @Override
            public void onBeginningOfSpeech() {
                Log.d(TAG, "onBeginningOfSpeech state=" + currentState);
                cancelSilenceTimer();
            }

            @Override
            public void onRmsChanged(float rmsdB) {}

            @Override
            public void onBufferReceived(byte[] buffer) {}

            @Override
            public void onEndOfSpeech() {
                Log.d(TAG, "onEndOfSpeech state=" + currentState);
                isListeningActive = false;
            }

            @Override
            public void onError(int error) {
                isListeningActive = false;
                Log.i(TAG, "[VOICE] wake_detection_error: code=" + error + " state=" + currentState);
                handleSpeechError(error);
            }

            @Override
            public void onResults(Bundle results) {
                isListeningActive = false;
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

    private synchronized void startListeningLoop() {
        if (!isServiceRunning || speechRecognizer == null) {
            return;
        }

        // Mutual exclusion: Do not listen while speaking or processing
        if (currentState == State.GREETING || currentState == State.PROCESSING || currentState == State.TTS) {
            return;
        }

        // Single-listener guard: If already actively listening, avoid duplicate calls
        if (isListeningActive) {
            return;
        }

        try {
            Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-IN");
            intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
            intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3);
            intent.putExtra("android.speech.extra.DICTATION_MODE", true);

            // Crucial: PREFER_OFFLINE ensures local wake word detection even without Wi-Fi/Internet!
            if (currentState == State.WAKE_LISTENING) {
                intent.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true);
                Log.i(TAG, "[VOICE] wake_listener_started (local offline preferred)");
            } else {
                Log.d(TAG, "Starting recognition loop in state=" + currentState);
            }

            speechRecognizer.startListening(intent);
            isListeningActive = true;
        } catch (Exception e) {
            Log.w(TAG, "startListeningLoop error: " + e.getMessage());
            isListeningActive = false;
            scheduleRestartListening(500);
        }
    }

    private void stopListeningTemporarily() {
        isListeningActive = false;
        if (speechRecognizer != null) {
            try {
                speechRecognizer.stopListening();
                speechRecognizer.cancel();
            } catch (Exception ignored) {}
        }
    }

    private void destroySpeechRecognizer() {
        isListeningActive = false;
        if (speechRecognizer != null) {
            try {
                speechRecognizer.stopListening();
                speechRecognizer.cancel();
                speechRecognizer.destroy();
            } catch (Exception ignored) {}
            speechRecognizer = null;
        }
    }

    private void handleSpeechResults(Bundle bundle, boolean isFinal) {
        if (bundle == null) return;
        ArrayList<String> matches = bundle.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        if (matches == null || matches.isEmpty()) {
            if (isFinal && currentState == State.WAKE_LISTENING) {
                // Recognition ended with empty results in WAKE_LISTENING.
                // Critical fix: Restart immediately so listener never dies!
                scheduleRestartListening(100);
            }
            return;
        }

        String recognizedText = matches.get(0).trim();
        if (recognizedText.isEmpty()) {
            if (isFinal && currentState == State.WAKE_LISTENING) {
                scheduleRestartListening(100);
            }
            return;
        }

        Log.d(TAG, "SpeechResult (isFinal=" + isFinal + ", state=" + currentState + "): " + recognizedText);

        if (eventListener != null) {
            mainHandler.post(() -> eventListener.onTranscript(recognizedText, isFinal));
        }

        // 1. STATE: WAKE_LISTENING — Local Wake Word Detection ("Hey Life" / "Life" / etc.)
        if (currentState == State.WAKE_LISTENING) {
            if (isWakeWordMatch(recognizedText)) {
                onWakeWordDetected();
            } else if (isFinal) {
                // Critical Fix for Intermittent Wake Word:
                // Non-matching speech result in WAKE_LISTENING ended the session.
                // MUST RESTART WAKE LISTENER IMMEDIATELY!
                Log.d(TAG, "Non-wake speech finished. Restarting wake listener.");
                scheduleRestartListening(100);
            }
        }
        // 2. STATE: USER_LISTENING or COOLDOWN — Capture User's Question
        else if (currentState == State.USER_LISTENING || currentState == State.COOLDOWN) {
            if (isFinal) {
                cancelSilenceTimer();

                // If user just repeated the wake word, greet again
                if (isWakeWordOnly(recognizedText)) {
                    speakText("Haan, bolo.", "wake_greeting");
                    return;
                }

                Log.i(TAG, "[VOICE] speech_result (query received)");
                processUserQuery(recognizedText);
            } else {
                // User is still speaking; keep extending silence timer
                resetSilenceTimer();
            }
        }
    }

    private void handleSpeechError(int error) {
        // Ignore errors that arrive after we already transitioned to speaking or processing
        if (currentState == State.GREETING || currentState == State.PROCESSING || currentState == State.TTS) {
            return;
        }

        consecutiveErrorCount++;

        // In USER_LISTENING / COOLDOWN:
        if (currentState == State.USER_LISTENING || currentState == State.COOLDOWN) {
            if (error == SpeechRecognizer.ERROR_NO_MATCH || error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT) {
                // If user said nothing, let silence timer handle graceful return to WAKE_LISTENING
                return;
            }
        }

        // If recognizer got busy (8) or client error (5) or audio error (3):
        // Recreate speechRecognizer instance to prevent persistent lockup
        if (error == SpeechRecognizer.ERROR_RECOGNIZER_BUSY || 
            error == SpeechRecognizer.ERROR_CLIENT || 
            error == SpeechRecognizer.ERROR_AUDIO ||
            consecutiveErrorCount >= 3) {
            
            Log.i(TAG, "[VOICE] listener_restarting (recreating audio session after error " + error + ")");
            destroySpeechRecognizer();
            
            long delay = Math.min(3000, 300 * consecutiveErrorCount);
            mainHandler.postDelayed(this::initAndStartSpeechRecognizer, delay);
            return;
        }

        // For normal silence or minor errors in WAKE_LISTENING:
        long restartDelay = (error == SpeechRecognizer.ERROR_NETWORK || error == SpeechRecognizer.ERROR_NETWORK_TIMEOUT) ? 1000 : 250;
        scheduleRestartListening(restartDelay);
    }

    private void scheduleRestartListening(long delayMs) {
        mainHandler.postDelayed(() -> {
            if (isServiceRunning && 
                currentState != State.GREETING && 
                currentState != State.PROCESSING && 
                currentState != State.TTS) {
                
                if (speechRecognizer == null) {
                    initAndStartSpeechRecognizer();
                } else {
                    startListeningLoop();
                }
            }
        }, delayMs);
    }

    // ==================== WAKE WORD DETECTION (100% LOCAL) ====================

    private boolean isWakeWordMatch(String text) {
        if (text == null) return false;
        String lower = text.toLowerCase().trim();

        String customWake = wakeWord != null ? wakeWord.toLowerCase().trim() : "hey life";
        if (lower.contains(customWake)) return true;

        // Rich phonetic variants for Indian English and Hindi pronunciation
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

    private synchronized void onWakeWordDetected() {
        if (currentState == State.WAKE_DETECTED || currentState == State.GREETING) {
            return; // Duplicate trigger guard
        }

        Log.i(TAG, "[VOICE] wake_detected (LOCAL on-device detection)");
        setState(State.WAKE_DETECTED);
        cancelSilenceTimer();

        // 100% Local Voice Greeting: Speak "Haan, bolo." via local Android TTS with zero Render request!
        speakText("Haan, bolo.", "wake_greeting");
    }

    private void startListeningForQuery() {
        resetSilenceTimer();
        startListeningLoop();
    }

    private void startFollowUpWindow() {
        resetSilenceTimer();
        startListeningLoop();
    }

    private void resetSilenceTimer() {
        cancelSilenceTimer();
        silenceTimeoutRunnable = () -> {
            Log.i(TAG, "[VOICE] speech_timeout (no speech input detected for " + silenceTimeoutMs + "ms)");
            setState(State.WAKE_LISTENING);
            activeConversationId = null;
            scheduleRestartListening(100);
        };
        mainHandler.postDelayed(silenceTimeoutRunnable, silenceTimeoutMs);
    }

    private void cancelSilenceTimer() {
        if (silenceTimeoutRunnable != null) {
            mainHandler.removeCallbacks(silenceTimeoutRunnable);
            silenceTimeoutRunnable = null;
        }
    }

    private void cancelAllTimers() {
        cancelSilenceTimer();
        if (stateTimeoutRunnable != null) {
            mainHandler.removeCallbacks(stateTimeoutRunnable);
            stateTimeoutRunnable = null;
        }
    }

    // ==================== WATCHDOG FOR SERVICE LONGEVITY ====================

    private void startWatchdog() {
        watchdogRunnable = new Runnable() {
            @Override
            public void run() {
                if (!isServiceRunning) return;

                long now = System.currentTimeMillis();
                long elapsedInState = now - stateEntryTimestamp;

                // Watchdog check 1: Stuck in intermediate states
                if (currentState == State.PROCESSING && elapsedInState > PROCESSING_TIMEOUT_MS) {
                    Log.w(TAG, "[VOICE] Watchdog detected stuck PROCESSING. Force-recovering to WAKE_LISTENING.");
                    setState(State.WAKE_LISTENING);
                    scheduleRestartListening(100);
                } else if (currentState == State.TTS && elapsedInState > TTS_MAX_TIMEOUT_MS) {
                    Log.w(TAG, "[VOICE] Watchdog detected stuck TTS. Force-recovering to WAKE_LISTENING.");
                    setState(State.WAKE_LISTENING);
                    scheduleRestartListening(100);
                } else if (currentState == State.WAKE_LISTENING) {
                    // Watchdog check 2: If in WAKE_LISTENING but recognizer is silently dead/inactive
                    if (!isListeningActive || speechRecognizer == null) {
                        Log.i(TAG, "[VOICE] listener_restarting (Watchdog revived inactive wake listener)");
                        initAndStartSpeechRecognizer();
                    }
                }

                mainHandler.postDelayed(this, WATCHDOG_INTERVAL_MS);
            }
        };
        mainHandler.postDelayed(watchdogRunnable, WATCHDOG_INTERVAL_MS);
    }

    private void stopWatchdog() {
        if (watchdogRunnable != null) {
            mainHandler.removeCallbacks(watchdogRunnable);
            watchdogRunnable = null;
        }
    }

    // ==================== BACKEND INTEGRATION ====================

    private void processUserQuery(String userQuery) {
        setState(State.PROCESSING);
        stopListeningTemporarily();
        Log.i(TAG, "[VOICE] backend_request_started");

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
                conn.setConnectTimeout(15000);
                conn.setReadTimeout(25000);
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

                    Log.i(TAG, "[VOICE] backend_response_received");

                    mainHandler.post(() -> {
                        if (eventListener != null) {
                            eventListener.onAssistantResponse(answer, activeConversationId);
                        }
                        speakText(answer, "query_answer");
                    });
                } else if (responseCode == 401 || responseCode == 403) {
                    Log.w(TAG, "[VOICE] backend_error HTTP " + responseCode + " (Auth required)");
                    mainHandler.post(() -> {
                        speakText("Kripya pehle app me login karein.", "auth_error");
                        if (eventListener != null) eventListener.onError("Authentication required");
                    });
                } else {
                    Log.w(TAG, "[VOICE] backend_error HTTP " + responseCode);
                    mainHandler.post(() -> {
                        speakText("Abhi Life server se connection nahi ho raha.", "server_error");
                        if (eventListener != null) eventListener.onError("Backend HTTP " + responseCode);
                    });
                }
            } catch (java.net.UnknownHostException e) {
                Log.e(TAG, "[VOICE] backend_error: Internet connection not available (Offline)");
                mainHandler.post(() -> {
                    speakText("Internet connection nahi hai.", "network_error");
                    if (eventListener != null) eventListener.onError("No internet connection");
                });
            } catch (java.net.SocketTimeoutException e) {
                Log.e(TAG, "[VOICE] backend_error: Request timed out");
                mainHandler.post(() -> {
                    speakText("Response lene mein thoda problem aa raha hai.", "timeout_error");
                    if (eventListener != null) eventListener.onError("Request timed out");
                });
            } catch (Exception e) {
                Log.e(TAG, "[VOICE] backend_error: " + e.getMessage(), e);
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
        String cleaned = text.replaceAll("\\[([^\\]]+)\\]\\([^)]+\\)", "$1");
        cleaned = cleaned.replaceAll("[*_#`~]", "");
        cleaned = cleaned.replaceAll("(?m)^\\s*[-•*]\\s+", "");
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

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Life AI Hands-Free Active")
            .setContentText(contentText)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentIntent(openAppPending)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Stop", stopPendingIntent)
            .build();
    }

    private void updateNotificationForState(State state) {
        String msg;
        switch (state) {
            case USER_LISTENING:
                msg = "Listening to you...";
                break;
            case PROCESSING:
                msg = "Thinking & searching memories...";
                break;
            case GREETING:
            case TTS:
                msg = "Life is speaking...";
                break;
            case COOLDOWN:
                msg = "Follow-up active (Say your next question)...";
                break;
            case WAKE_DETECTED:
                msg = "Wake word detected!";
                break;
            case ERROR:
                msg = "Microphone error. Recovering...";
                break;
            case WAKE_LISTENING:
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
