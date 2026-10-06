/**
 * Life AI — Central VoiceEngine & Continuous Conversation Controller
 * Single Source of Truth for hands-free continuous multi-turn human conversation,
 * wake-word detection, speech-end VAD, acoustic echo gating, and resilient state transitions.
 */

import { VoiceState, DetailedVoiceState } from '../types';
import { api, getServerHostUrl } from './api';
import { handsFreeService } from './handsFreeService';
import { fastIntentRouter } from './fastIntentRouter';
import { executeServerTools } from './toolExecutor';
import { musicService } from './musicService';

export interface VoiceEngineSnapshot {
  voiceState: VoiceState;
  detailedVoiceState: DetailedVoiceState;
  transcript: string;
  assistantResponse: string;
  voiceError: string | null;
  isVoiceModeEnabled: boolean;
  isConversationActive: boolean;
  isWakeWordEnabled: boolean;
  isHandsFreeMode: boolean;
  micPermissionError: boolean;
  micPermissionGranted: boolean;
  activeConversationId: string | null;
  wakeWord: string;
  voiceResponseEnabled: boolean;
  isNativePlatform: boolean;
  isBatteryOptimizedExempt: boolean;
  isAudioSpeaking: boolean;
  audioEnergy: number; // 0.0 - 1.0 (TTS mouth animation)
  inputVolume: number; // 0.0 - 1.0 (Microphone live level)
  sttEngine: 'web_speech' | 'gemini_multimodal' | 'unavailable';
  isBackendOnline: boolean;
  streamActive: boolean;
  audioSampleRate: number;
  audioChannels: number;
  isLocalTesting: boolean;
}

interface IWindow extends Window {
  webkitSpeechRecognition: any;
  SpeechRecognition: any;
  _currentUtterance?: any;
}

class VoiceEngine {
  private static instance: VoiceEngine;

  // Subscribers
  private listeners: Set<(snapshot: VoiceEngineSnapshot) => void> = new Set();

  // Primary State Machine
  private voiceState: VoiceState = 'idle';
  private detailedVoiceState: DetailedVoiceState = 'idle';
  private transcript: string = '';
  private assistantResponse: string = '';
  private voiceError: string | null = null;

  // Conversation Controller Flags
  private isVoiceModeEnabled: boolean = true;
  private isConversationActive: boolean = false;
  private isWakeWordEnabled: boolean = true;
  private isHandsFreeMode: boolean = false;
  private wakeWord: string = 'Hey Life';
  private voiceResponseEnabled: boolean = true;
  private isNative: boolean = false;
  private isBatteryOptimizedExempt: boolean = true;

  // Hardware & Connectivity State
  private micPermissionError: boolean = false;
  private micPermissionGranted: boolean = false;
  private streamActive: boolean = false;
  private audioSampleRate: number = 48000;
  private audioChannels: number = 1;
  private sttEngine: 'web_speech' | 'gemini_multimodal' | 'unavailable' = 'web_speech';
  private isBackendOnline: boolean = true;
  private activeConversationId: string | null = null;

  // Audio Meters & Lip-Sync
  private isAudioSpeaking: boolean = false;
  private audioEnergy: number = 0;
  private inputVolume: number = 0;
  private lastVolUpdate: number = 0;

  // Persistent Media Stream & Web Audio Context
  private activeStream: MediaStream | null = null;
  private inputAudioCtx: AudioContext | null = null;
  private inputAnalyser: AnalyserNode | null = null;
  private inputAnimFrame: number | null = null;

  // Recording Buffer for STT Fallback
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];

  // Active Recognition Singleton & Shared State
  private sharedRecognition: any = null;
  private isRecognitionRunning: boolean = false;
  private recognitionMode: 'query' | 'wake' | 'test' = 'query';
  private consecutiveErrors: number = 0;
  private restartTimer: any = null;
  private isLocalTesting: boolean = false;
  private localTestCallback: ((transcript: string, isFinal: boolean) => void) | null = null;

  private isMicGated: boolean = false;
  private isSpeaking: boolean = false;
  private isListeningSession: boolean = false;

  // Utterance Accumulation Refs
  private accumulatedTranscript: string = '';
  private lastSpokenText: string = '';
  private speechDetected: boolean = false;
  private speechStartTime: number = 0;

  // TTS Output
  private outputAudioPlayer: HTMLAudioElement | null = null;
  private outputAudioCtx: AudioContext | null = null;
  private outputAnimFrame: number | null = null;
  private cadenceInterval: any = null;
  private ttsSafetyTimeout: any = null;

  // Watchdogs & Timers
  private speechPauseTimer: any = null;
  private conversationTimeoutTimer: any = null;
  private wakeRecoveryTimer: any = null;
  private echoCooldownTimer: any = null;

  // Configurable Parameters
  private readonly ECHO_COOLDOWN_MS = 650;
  private readonly END_SILENCE_MS = 850;
  private readonly CONVERSATION_SILENCE_TIMEOUT_MS = 20000;

  private isInitialized: boolean = false;

  private constructor() {
    this.isNative = handsFreeService.isNativeAvailable();
    this.isHandsFreeMode = handsFreeService.isEnabledLocally();
    this.wakeWord = handsFreeService.getWakeWord();
    this.voiceResponseEnabled = handsFreeService.isVoiceResponseEnabled();

    // Check stored voice activation mode (defaults to true)
    const storedVoiceMode = localStorage.getItem('life_voice_mode_enabled');
    if (storedVoiceMode !== null) {
      this.isVoiceModeEnabled = storedVoiceMode === 'true';
    } else {
      this.isVoiceModeEnabled = true;
    }

    const storedWake = localStorage.getItem('life_wake_word_enabled');
    if (storedWake !== null) {
      this.isWakeWordEnabled = storedWake === 'true';
    } else {
      this.isWakeWordEnabled = true;
    }
  }

  public static getInstance(): VoiceEngine {
    if (!VoiceEngine.instance) {
      VoiceEngine.instance = new VoiceEngine();
    }
    return VoiceEngine.instance;
  }

  /**
   * Initializes the engine once on application startup.
   */
  public async init(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;
    console.log('[VOICE] engine initialized');

    // Detect STT capability
    const SpeechRecognitionClass =
      (window as unknown as IWindow).SpeechRecognition ||
      (window as unknown as IWindow).webkitSpeechRecognition;

    if (SpeechRecognitionClass) {
      this.sttEngine = 'web_speech';
      console.log('[VOICE] STT Engine detected: Web Speech API supported.');
    } else {
      this.sttEngine = 'gemini_multimodal';
      console.log('[VOICE] STT Engine: Web Speech API not detected, defaulting to Gemini Multimodal STT.');
    }

    // Ping backend health
    try {
      await api.checkHealth();
      this.isBackendOnline = true;
    } catch {
      this.isBackendOnline = false;
    }

    // Set up lifecycle hooks for automatic foreground listening & strict background mic release
    this.setupAppLifecycle();

    // Hook up native Android listeners if on native platform
    if (this.isNative) {
      this.setupNativeListeners();
      if (this.isVoiceModeEnabled) {
        console.log('[VOICE] Native platform: starting HandsFreeVoiceService and triggering auto-listen');
        handsFreeService.start().then(() => {
          handsFreeService.triggerListen().catch(() => {});
        }).catch((err) => {
          console.warn('[VOICE] Automatic native start note:', err);
        });
      }
    } else {
      if (this.isVoiceModeEnabled) {
        console.log('[VOICE] Voice mode enabled: activating foreground auto-listen');
        this.checkMicPermissionStatus().then((hasPerm) => {
          if (hasPerm) {
            console.log('[VOICE] Microphone permission previously granted. Listening automatically.');
            this.startQueryListening();
          } else {
            console.log('[VOICE] Microphone permission pending. Setting state to ready.');
            this.setDetailedState('ready');
          }
        }).catch(() => {
          this.setDetailedState('ready');
        });
      } else {
        this.setDetailedState('disabled');
      }
    }

    this.notify();
  }

  private isAppInForeground: boolean = true;

  private setupAppLifecycle(): void {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.onAppBackground();
        } else if (document.visibilityState === 'visible') {
          this.onAppForeground();
        }
      });

      window.addEventListener('pagehide', () => {
        this.onAppBackground();
      });

      window.addEventListener('blur', () => {
        if (typeof document !== 'undefined' && document.hidden) {
          this.onAppBackground();
        }
      });

      window.addEventListener('focus', () => {
        if (typeof document !== 'undefined' && !document.hidden && this.isVoiceModeEnabled) {
          this.onAppForeground();
        }
      });
    }

    try {
      const cap = typeof window !== 'undefined' ? (window as any).Capacitor : null;
      if (cap && cap.Plugins && cap.Plugins.App && typeof cap.Plugins.App.addListener === 'function') {
        cap.Plugins.App.addListener('appStateChange', (state: { isActive: boolean }) => {
          if (!state.isActive) {
            this.onAppBackground();
          } else {
            this.onAppForeground();
          }
        });
      }
    } catch (_) {}
  }

  public onAppBackground(): void {
    console.log('[VOICE] AppState = background');
    this.isAppInForeground = false;
    this.stopCurrentRecognition();
    this.releaseMicrophoneStream();
    if (this.speechPauseTimer) clearTimeout(this.speechPauseTimer);
    if (this.conversationTimeoutTimer) clearTimeout(this.conversationTimeoutTimer);
    if (this.echoCooldownTimer) clearTimeout(this.echoCooldownTimer);
    if (this.wakeRecoveryTimer) clearTimeout(this.wakeRecoveryTimer);
    this.gateMicrophone(true);
    this.setDetailedState('idle');

    if (this.isNative) {
      handsFreeService.pauseListening().catch(() => {});
    }
  }

  public async onAppForeground(): Promise<void> {
    console.log('[VOICE] AppState = active');
    this.isAppInForeground = true;
    this.gateMicrophone(false);

    if (!this.isVoiceModeEnabled) {
      this.setDetailedState('disabled');
      return;
    }

    if (this.isNative) {
      try {
        await handsFreeService.resumeListening();
      } catch (_) {}
      return;
    }

    try {
      const hasPerm = await this.checkMicPermissionStatus();
      if (hasPerm) {
        console.log('[VOICE] Foreground auto-listening active without button press.');
        this.startQueryListening();
      } else {
        this.setDetailedState('ready');
      }
    } catch {
      this.setDetailedState('ready');
    }
  }

  public async checkMicPermissionStatus(): Promise<boolean> {
    if (this.isNative) {
      const perm = await handsFreeService.checkPermissions();
      return perm.microphone;
    }
    try {
      if (navigator.permissions && (navigator.permissions as any).query) {
        const status = await (navigator.permissions as any).query({ name: 'microphone' });
        return status.state === 'granted';
      }
    } catch (_) {}
    return this.micPermissionGranted;
  }

  /**
   * Subscribes a listener function to receive state updates.
   */
  public subscribe(listener: (snapshot: VoiceEngineSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getSnapshot(): VoiceEngineSnapshot {
    return {
      voiceState: this.voiceState,
      detailedVoiceState: this.detailedVoiceState,
      transcript: this.transcript,
      assistantResponse: this.assistantResponse,
      voiceError: this.voiceError,
      isVoiceModeEnabled: this.isVoiceModeEnabled,
      isConversationActive: this.isConversationActive,
      isWakeWordEnabled: this.isWakeWordEnabled,
      isHandsFreeMode: this.isHandsFreeMode,
      micPermissionError: this.micPermissionError,
      micPermissionGranted: this.micPermissionGranted,
      activeConversationId: this.activeConversationId,
      wakeWord: this.wakeWord,
      voiceResponseEnabled: this.voiceResponseEnabled,
      isNativePlatform: this.isNative,
      isBatteryOptimizedExempt: this.isBatteryOptimizedExempt,
      isAudioSpeaking: this.isAudioSpeaking,
      audioEnergy: this.audioEnergy,
      inputVolume: this.inputVolume,
      sttEngine: this.sttEngine,
      isBackendOnline: this.isBackendOnline,
      streamActive: this.streamActive,
      audioSampleRate: this.audioSampleRate,
      audioChannels: this.audioChannels,
      isLocalTesting: this.isLocalTesting
    };
  }

  private notify(): void {
    const snap = this.getSnapshot();
    this.listeners.forEach((fn) => {
      try {
        fn(snap);
      } catch (err) {
        console.error('[VOICE] subscriber error:', err);
      }
    });
  }

  private setDetailedState(detailed: DetailedVoiceState): void {
    this.detailedVoiceState = detailed;
    switch (detailed) {
      case 'off':
      case 'stopped':
      case 'disabled':
      case 'idle':
      case 'ready':
      case 'initializing':
      case 'starting_mic':
      case 'recovering':
        this.voiceState = 'idle';
        break;
      case 'listening':
      case 'user_listening':
      case 'audio_detected':
      case 'speech_detected':
      case 'rearming':
      case 'wake_listening':
        this.voiceState = 'listening';
        break;
      case 'processing':
      case 'thinking':
      case 'transcribing':
        this.voiceState = 'thinking';
        break;
      case 'wake_detected':
      case 'greeting':
      case 'tts':
      case 'speaking':
        this.voiceState = 'speaking';
        break;
      case 'error':
        this.voiceState = 'error';
        break;
      default:
        this.voiceState = 'idle';
        break;
    }

    // Dynamic music ducking: duck music volume during listening or speaking, restore when idle
    try {
      if (this.voiceState === 'listening' || this.voiceState === 'speaking') {
        musicService.duckVolume(20);
      } else {
        musicService.restoreVolume();
      }
    } catch (_) {}

    this.notify();
  }

  // =========================================================================
  // PERSISTENT MICROPHONE MANAGEMENT
  // =========================================================================

  private async ensureLiveMicrophoneStream(): Promise<MediaStream> {
    if (this.isNative) {
      this.micPermissionGranted = true;
      this.micPermissionError = false;
      this.streamActive = true;
      return null as any;
    }

    if (this.activeStream && this.activeStream.active && this.activeStream.getAudioTracks().some((t) => t.readyState === 'live')) {
      return this.activeStream;
    }

    console.log('[VOICE] checking microphone permission');
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('navigator.mediaDevices.getUserMedia is not supported on this browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      const audioTracks = stream.getAudioTracks();
      if (!audioTracks || audioTracks.length === 0 || audioTracks[0].readyState !== 'live') {
        throw new Error('No live audio track received from microphone.');
      }

      console.log(`[VOICE] microphone permission granted (Track: ${audioTracks[0].label || 'Default Mic'})`);
      console.log('[VOICE] microphone ready');
      console.log('[VOICE] microphone started');
      this.activeStream = stream;
      this.micPermissionGranted = true;
      this.micPermissionError = false;
      this.streamActive = true;

      const trackSettings = audioTracks[0].getSettings ? audioTracks[0].getSettings() : {};
      this.audioSampleRate = trackSettings.sampleRate || 48000;
      this.audioChannels = trackSettings.channelCount || 1;

      this.startAudioInputMeter(stream);
      this.notify();
      return stream;
    } catch (err: any) {
      console.error('[VOICE ERROR] microphone error:', err);
      this.micPermissionError = true;
      this.micPermissionGranted = false;
      this.streamActive = false;
      this.voiceError = err.message || 'Microphone access denied';
      this.setDetailedState('error');
      throw err;
    }
  }

  private startAudioInputMeter(stream: MediaStream): void {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      if (!this.inputAudioCtx || this.inputAudioCtx.state === 'closed') {
        this.inputAudioCtx = new AudioCtx();
      }
      if (this.inputAudioCtx.state === 'suspended') {
        this.inputAudioCtx.resume().catch(() => {});
      }

      const ctx = this.inputAudioCtx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.3;
      source.connect(analyser);
      this.inputAnalyser = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const sampleLoop = () => {
        if (!this.activeStream || this.isMicGated) {
          if (this.inputVolume !== 0) {
            this.inputVolume = 0;
            this.notify();
          }
          this.inputAnimFrame = requestAnimationFrame(sampleLoop);
          return;
        }

        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const vol = Math.min(1.0, (avg / 128) * 1.8);

        const now = performance.now();
        if (now - this.lastVolUpdate > 75) {
          this.lastVolUpdate = now;
          this.inputVolume = vol;
          this.notify();
        }

        this.inputAnimFrame = requestAnimationFrame(sampleLoop);
      };

      if (this.inputAnimFrame) cancelAnimationFrame(this.inputAnimFrame);
      this.inputAnimFrame = requestAnimationFrame(sampleLoop);
    } catch (e) {
      console.warn('[VOICE] input meter note:', e);
    }
  }

  private stopAudioInputMeter(): void {
    if (this.inputAnimFrame) {
      cancelAnimationFrame(this.inputAnimFrame);
      this.inputAnimFrame = null;
    }
    this.inputVolume = 0;
  }

  public releaseMicrophoneStream(): void {
    this.stopAudioInputMeter();
    if (this.activeStream) {
      this.activeStream.getTracks().forEach((track) => track.stop());
      this.activeStream = null;
      this.streamActive = false;
      console.log('[VOICE] microphone stream stopped and tracks released');
      this.notify();
    }
  }

  // =========================================================================
  // ACOUSTIC ECHO GATING (PREVENTS LIFE AI FROM HEARING ITSELF)
  // =========================================================================

  private gateMicrophone(gate: boolean): void {
    this.isMicGated = gate;
    if (gate) {
      this.inputVolume = 0;
      this.stopCurrentRecognition();
    }
    this.notify();
  }

  // =========================================================================
  // SINGLETON SPEECH RECOGNITION (WEB SPEECH API)
  // =========================================================================

  private getOrCreateRecognition(): any {
    if (this.sharedRecognition) {
      return this.sharedRecognition;
    }

    const SpeechRecognitionClass =
      (window as unknown as IWindow).SpeechRecognition ||
      (window as unknown as IWindow).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      return null;
    }

    try {
      const rec = new SpeechRecognitionClass();
      rec.continuous = false; // Controlled per-utterance session: prevents Chrome desktop hanging
      rec.interimResults = true;
      rec.lang = 'en-IN'; // Indian English / Roman Hinglish transcript
      rec.maxAlternatives = 1;

      rec.onstart = () => {
        this.isRecognitionRunning = true;
        this.consecutiveErrors = 0;
        if (this.recognitionMode === 'test') {
          console.log('[VOICE TEST] Diagnostic recognition started');
        } else if (this.recognitionMode === 'query') {
          console.log('[VOICE] microphone ready');
          console.log('[VOICE] microphone started');
          console.log('[VOICE] listening again');
          if (this.detailedVoiceState !== 'speech_detected') {
            this.setDetailedState('listening');
          }
        } else {
          this.setDetailedState('ready');
        }
      };

      rec.onspeechstart = () => {
        if (!this.speechDetected) {
          console.log('[VOICE] Speech sound detected by recognizer');
          if (this.recognitionMode === 'query' && this.detailedVoiceState === 'listening') {
            // Audio detected, but DO NOT show "Hearing you..." until actual words arrive in onresult!
            this.setDetailedState('audio_detected');
          }
        }
        if (this.conversationTimeoutTimer) clearTimeout(this.conversationTimeoutTimer);
      };

      rec.onresult = (event: any) => {
        if (this.isMicGated || this.isSpeaking) return;

        let interim = '';
        let finalStr = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i][0];
          if (event.results[i].isFinal) {
            finalStr += item.transcript;
          } else {
            interim += item.transcript;
          }
        }

        const currentText = (finalStr || interim).trim();

        // 1. Diagnostic Local Test Mode (No Backend / No AI)
        if (this.recognitionMode === 'test') {
          if (currentText && this.localTestCallback) {
            this.localTestCallback(currentText, !!finalStr);
          }
          if (finalStr) {
            console.log(`[VOICE TEST] Final test transcript: "${finalStr}"`);
          }
          return;
        }

        // 2. Wake Word Standby Mode
        if (this.recognitionMode === 'wake') {
          const lower = currentText.toLowerCase();
          const targetWake = this.wakeWord.toLowerCase();
          if (
            lower.includes(targetWake) ||
            lower.includes('hey life') ||
            lower.includes('life') ||
            lower.includes('hey jeet') ||
            lower.includes('jeet')
          ) {
            console.log(`[VOICE] wake word detected: "${currentText}"`);
            this.stopCurrentRecognition();
            this.handleWakeDetected();
          }
          return;
        }

        // 3. Continuous Query Mode (User Utterance)
        if (currentText) {
          if (!this.speechDetected) {
            console.log('[VOICE] speech started');
            this.speechDetected = true;
            this.speechStartTime = Date.now();
          }

          // ONLY transition to 'speech_detected' ("Hearing you...") when actual words arrive!
          this.setDetailedState('speech_detected');

          this.accumulatedTranscript = currentText;
          this.lastSpokenText = currentText;
          this.transcript = currentText;
          this.notify();

          if (interim) {
            console.log(`[VOICE] interim transcript: "${interim}"`);
          }
          if (finalStr) {
            console.log(`[VOICE] final transcript = "${finalStr}"`);
          }

          if (this.conversationTimeoutTimer) clearTimeout(this.conversationTimeoutTimer);

          // End-of-speech silence timer: auto-submit if browser takes too long to fire onend
          if (this.speechPauseTimer) clearTimeout(this.speechPauseTimer);
          this.speechPauseTimer = setTimeout(() => {
            if (this.isListeningSession && this.speechDetected) {
              console.log('[VOICE] speech ended');
              this.stopCurrentRecognition();
            }
          }, this.END_SILENCE_MS);
        }
      };

      rec.onerror = (e: any) => {
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
          console.error('[VOICE ERROR] microphone error: permission denied');
          this.micPermissionError = true;
          this.voiceError = 'Microphone permission required.';
          this.setDetailedState('error');
        } else if (e.error === 'no-speech') {
          // Benign browser silence timeout
        } else if (e.error !== 'aborted') {
          console.warn('[VOICE ERROR] speech recognition error:', e.error);
          this.consecutiveErrors++;
        }
      };

      rec.onend = () => {
        this.isRecognitionRunning = false;

        // Diagnostic test mode: auto-loop test listening
        if (this.recognitionMode === 'test') {
          if (this.isLocalTesting) {
            setTimeout(() => {
              if (this.isLocalTesting) {
                this.safeStartRecognition();
              }
            }, 200);
          }
          return;
        }

        // If speaking, gated, or app backgrounded: do not restart
        if (this.isSpeaking || this.isMicGated || !this.isAppInForeground) {
          return;
        }

        // Utterance captured?
        const candidate = (this.lastSpokenText || this.accumulatedTranscript || this.transcript || '').trim();
        if (candidate && this.speechDetected) {
          console.log('[VOICE] speech ended');
          this.processCompletedUtterance(candidate);
          return;
        }

        // Silence: re-arm query listening or wake standby without tight loop
        if (this.recognitionMode === 'query' && this.isListeningSession && this.isConversationActive && this.isVoiceModeEnabled) {
          const delay = Math.min(2000, 250 + this.consecutiveErrors * 350);
          this.restartTimer = setTimeout(() => {
            if (
              this.recognitionMode === 'query' &&
              this.isListeningSession &&
              this.isConversationActive &&
              this.isVoiceModeEnabled &&
              !this.isSpeaking &&
              !this.isMicGated &&
              this.isAppInForeground
            ) {
              this.safeStartRecognition();
            }
          }, delay);
        } else if (this.recognitionMode === 'wake' && this.isVoiceModeEnabled && !this.isSpeaking && this.isAppInForeground) {
          this.restartTimer = setTimeout(() => {
            if (this.recognitionMode === 'wake' && this.isVoiceModeEnabled && !this.isSpeaking && this.isAppInForeground) {
              this.safeStartRecognition();
            }
          }, 350);
        }
      };

      this.sharedRecognition = rec;
      return rec;
    } catch (err) {
      console.error('[VOICE ERROR] SpeechRecognition initialization failed:', err);
      return null;
    }
  }

  private safeStartRecognition(): void {
    if (this.isNative || !this.isAppInForeground || this.isSpeaking || this.isMicGated) {
      return;
    }
    const rec = this.getOrCreateRecognition();
    if (!rec) return;

    if (this.isRecognitionRunning) {
      return;
    }

    try {
      rec.start();
    } catch (err: any) {
      if (err.name !== 'InvalidStateError') {
        console.warn('[VOICE ERROR] recognition start failed:', err);
      }
    }
  }

  private stopCurrentRecognition(): void {
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    if (this.sharedRecognition && this.isRecognitionRunning) {
      try {
        this.sharedRecognition.abort();
      } catch (_) {}
      this.isRecognitionRunning = false;
    }
  }

  // =========================================================================
  // WAKE WORD LISTENER ("Hey Life")
  // =========================================================================

  public async startWakeWordListening(): Promise<void> {
    if (this.isNative || !this.isVoiceModeEnabled || this.isSpeaking || this.isListeningSession) {
      return;
    }
    this.recognitionMode = 'wake';
    try {
      await this.ensureLiveMicrophoneStream();
      this.setDetailedState('ready');
      this.safeStartRecognition();
    } catch (err) {
      console.warn('[VOICE ERROR] startWakeWordListening failed:', err);
    }
  }

  public stopWakeWordListening(): void {
    if (this.recognitionMode === 'wake') {
      this.stopCurrentRecognition();
    }
  }

  private async handleWakeDetected(): Promise<void> {
    console.log('[VOICE] conversation started');
    this.isConversationActive = true;
    this.setDetailedState('wake_detected');
    this.transcript = '';
    this.assistantResponse = '';
    this.voiceError = null;
    this.notify();

    // Play greeting "Haan, bolo." with mic gated
    this.speakText('Haan, bolo.', () => {
      this.startQueryListening();
    });
  }

  // =========================================================================
  // QUERY LISTENING MODE (Continuous Multi-Turn Human Conversation)
  // =========================================================================

  public async triggerManualListen(): Promise<void> {
    console.log('[VOICE] microphone button pressed');

    if (this.isNative) {
      try {
        console.log('[VOICE] Triggering native speech listener...');
        await handsFreeService.triggerListen();
        this.isConversationActive = true;
        this.isHandsFreeMode = true;
        this.micPermissionError = false;
        this.setDetailedState('user_listening');
      } catch (err: any) {
        console.error('[VOICE ERROR] Failed to trigger native listen:', err);
        try {
          await handsFreeService.start();
          await handsFreeService.triggerListen();
        } catch (inner: any) {
          this.micPermissionError = true;
          this.voiceError = inner.message || 'Microphone access required';
        }
      }
      this.notify();
      return;
    }

    // Barge-in Interruption: If currently speaking, stop TTS immediately and listen
    if (this.isSpeaking) {
      console.log('[VOICE] barge-in interruption triggered by user');
      this.stopTTSOutput();
      this.isSpeaking = false;
      this.gateMicrophone(false);
      this.isConversationActive = true;
      await this.startQueryListening();
      return;
    }

    // If already in an active listening session, toggle voice conversation OFF
    if (this.isListeningSession) {
      console.log('[VOICE] conversation stopped by user action');
      this.stopVoice();
      return;
    }

    // Otherwise start continuous voice conversation mode
    this.isConversationActive = true;
    this.isVoiceModeEnabled = true;
    localStorage.setItem('life_voice_mode_enabled', 'true');
    await this.startQueryListening();
  }

  public async startQueryListening(): Promise<void> {
    if (this.isNative) {
      console.log('[VOICE] On native platform, query listening handled by native HandsFreeVoiceService.');
      return;
    }
    if (!this.isVoiceModeEnabled || !this.isAppInForeground) return;

    this.stopCurrentRecognition();
    this.gateMicrophone(false);

    this.recognitionMode = 'query';
    this.isListeningSession = true;
    this.isConversationActive = true;
    this.transcript = '';
    this.accumulatedTranscript = '';
    this.lastSpokenText = '';
    this.speechDetected = false;
    this.voiceError = null;

    this.setDetailedState('listening');
    this.resetConversationSilenceTimeout();

    try {
      await this.ensureLiveMicrophoneStream();
      this.safeStartRecognition();
    } catch (err: any) {
      console.error('[VOICE ERROR] query listen start failed:', err);
      this.isListeningSession = false;
      this.setDetailedState('ready');
    }
  }

  private resetConversationSilenceTimeout(): void {
    if (this.conversationTimeoutTimer) clearTimeout(this.conversationTimeoutTimer);
    this.conversationTimeoutTimer = setTimeout(() => {
      if (this.isListeningSession && !this.speechDetected && !this.isSpeaking) {
        console.log('[VOICE] conversation standby timeout');
        this.isConversationActive = false;
        this.stopCurrentRecognition();
        this.setDetailedState('ready');
      }
    }, this.CONVERSATION_SILENCE_TIMEOUT_MS);
  }

  private async processCompletedUtterance(candidateText: string): Promise<void> {
    if (this.speechPauseTimer) clearTimeout(this.speechPauseTimer);
    if (this.conversationTimeoutTimer) clearTimeout(this.conversationTimeoutTimer);

    this.isListeningSession = false;
    this.speechDetected = false;
    this.stopCurrentRecognition();

    console.log(`[VOICE] final transcript = "${candidateText}"`);
    this.transcript = candidateText;
    this.setDetailedState('transcribing');

    // Check for user goodbye / stop phrases
    const lowerCandidate = candidateText.toLowerCase().trim();
    if (
      lowerCandidate === 'bye' ||
      lowerCandidate === 'bye bye' ||
      lowerCandidate === 'goodbye' ||
      lowerCandidate === 'alvida' ||
      lowerCandidate === 'stop' ||
      lowerCandidate === 'stop conversation' ||
      lowerCandidate.includes('alvida life') ||
      lowerCandidate.includes('chalo theek hai')
    ) {
      console.log('[VOICE] conversation ended by user gesture');
      this.isConversationActive = false;
      this.speakText('Theek hai, alvida! Jab bhi zaroorat ho, bas baat kar lena.', () => {
        this.returnToWakeListening();
      });
      return;
    }

    await this.handleUserUtterance(candidateText);
  }

  // =========================================================================
  // AI PROCESSING & AGENT REQUEST
  // =========================================================================

  private async handleUserUtterance(userText: string): Promise<void> {
    if (!userText || this.isSpeaking) return;
    const cleanText = userText.trim();
    if (!cleanText || cleanText === '.' || cleanText === ',' || cleanText.toLowerCase() === 'uh' || cleanText.toLowerCase() === 'ah') {
      console.log('[VOICE] Ignoring noise token:', cleanText);
      if (this.isConversationActive) {
        this.startQueryListening();
      }
      return;
    }

    // Fast Device Intent Interception (<50ms for Alarms, Music, Personal Facts)
    try {
      const fastResult = await fastIntentRouter.route(cleanText);
      if (fastResult.handled) {
        console.log(`[VOICE] fast intent handled: "${fastResult.responseText}"`);
        this.assistantResponse = fastResult.responseText;
        this.voiceError = null;
        this.notify();
        this.speakText(fastResult.responseText, () => {
          this.onTTSFinished();
        });
        return;
      }
    } catch (fastErr) {
      console.warn('[VOICE] Fast intent evaluation notice:', fastErr);
    }

    console.log('[VOICE] thinking started');
    console.log(`[VOICE] backend request started for query: "${cleanText}"`);
    this.setDetailedState('thinking');

    try {
      const res = await api.sendMessage({
        content: cleanText,
        conversation_id: this.activeConversationId || undefined,
        timezone: 'Asia/Kolkata',
        voice_mode: true
      });

      console.log(`[VOICE] backend response received: "${(res.response || '').substring(0, 50)}..."`);
      this.activeConversationId = res.conversation_id;
      this.assistantResponse = res.response;
      this.voiceError = null;
      this.notify();

      if ((res as any).tools_executed) {
        executeServerTools((res as any).tools_executed).catch((toolErr) => {
          console.warn('[VOICE] Tool execution notice:', toolErr);
        });
      }

      if (res.audio_url) {
        this.playAudioResponse(res.audio_url, res.response);
      } else {
        this.speakText(res.response, () => {
          this.onTTSFinished();
        });
      }
    } catch (err: any) {
      console.error('[VOICE ERROR] agent API failure:', err);
      const errMsg = err?.message || 'Server communication failed';
      this.voiceError = `Life AI Backend error: ${errMsg}`;
      this.isBackendOnline = false;

      const voiceReply = !navigator.onLine
        ? 'Internet connection nahi hai. Kripya apna network check karein.'
        : 'Kshama kijiye, mujhe response process karne mein dikkat aayi.';

      this.assistantResponse = voiceReply;
      this.notify();
      this.speakText(voiceReply, () => {
        this.onTTSFinished();
      });
    }
  }

  // =========================================================================
  // TTS PLAYBACK & SYNCHRONIZED AVATAR LIP-SYNC
  // =========================================================================

  public playAudioResponse(url: string, fallbackText: string = ''): void {
    this.gateMicrophone(true);
    this.isSpeaking = true;
    console.log('[VOICE] TTS started');
    this.setDetailedState('speaking');

    this.stopTTSOutput();

    const host = getServerHostUrl();
    const resolvedUrl = url.startsWith('http') ? url : `${host}${url.startsWith('/') ? '' : '/'}${url}`;
    const audio = new Audio(resolvedUrl);
    audio.crossOrigin = 'anonymous';
    this.outputAudioPlayer = audio;

    const onFinish = () => {
      this.onTTSFinished();
    };

    audio.onended = onFinish;
    audio.onerror = () => {
      console.warn('[VOICE] Audio playback failed, falling back to browser speech synthesis.');
      this.stopOutputAudioAnalysis();
      if (fallbackText) {
        this.speakText(fallbackText, () => this.onTTSFinished());
      } else {
        onFinish();
      }
    };

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        if (!this.outputAudioCtx || this.outputAudioCtx.state === 'closed') {
          this.outputAudioCtx = new AudioCtx();
        }
        const ctx = this.outputAudioCtx;
        if (ctx.state === 'suspended') ctx.resume();

        const source = ctx.createMediaElementSource(audio);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);
        analyser.connect(ctx.destination);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        let lastNotifyTime = 0;
        const sampleAudio = () => {
          if (!this.isSpeaking) {
            this.stopOutputAudioAnalysis();
            return;
          }
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          this.audioEnergy = Math.min(1.0, Math.max(0, avg / 75));
          this.isAudioSpeaking = avg > 6;

          const now = performance.now();
          if (now - lastNotifyTime > 80) {
            lastNotifyTime = now;
            this.notify();
          }

          this.outputAnimFrame = requestAnimationFrame(sampleAudio);
        };
        this.outputAnimFrame = requestAnimationFrame(sampleAudio);
      } else {
        this.startCadenceFallback();
      }
    } catch {
      this.startCadenceFallback();
    }

    audio.play().catch(() => {
      this.startCadenceFallback();
      if (fallbackText) {
        this.speakText(fallbackText, () => this.onTTSFinished());
      } else {
        onFinish();
      }
    });
  }

  public speakText(text: string, onCompleted?: () => void): void {
    if (!window.speechSynthesis) {
      this.stopOutputAudioAnalysis();
      if (onCompleted) onCompleted();
      return;
    }

    this.gateMicrophone(true);
    window.speechSynthesis.cancel();
    this.isSpeaking = true;
    console.log('[VOICE] TTS started');
    this.setDetailedState('speaking');

    const utterance = new SpeechSynthesisUtterance(text);
    (window as unknown as IWindow)._currentUtterance = utterance;

    const voices = window.speechSynthesis.getVoices();
    // Prefer Indian English female voice (en-IN), fallback to generic English female voice
    const femaleVoice =
      voices.find(
        (v) =>
          v.lang.toLowerCase().startsWith('en-in') &&
          (v.name.toLowerCase().includes('neerja') ||
            v.name.toLowerCase().includes('ananya') ||
            v.name.toLowerCase().includes('female') ||
            (v as any).gender === 'female')
      ) ||
      voices.find((v) => v.lang.toLowerCase().startsWith('en-in')) ||
      voices.find(
        (v) =>
          v.lang.toLowerCase().startsWith('en') &&
          (v.name.toLowerCase().includes('zira') ||
            v.name.toLowerCase().includes('samantha') ||
            v.name.toLowerCase().includes('female') ||
            (v as any).gender === 'female')
      ) ||
      voices.find((v) => v.lang.toLowerCase().startsWith('en'));

    if (femaleVoice) {
      utterance.voice = femaleVoice;
      utterance.lang = femaleVoice.lang;
    } else {
      utterance.lang = 'en-IN';
    }
    utterance.rate = 0.95;

    const onFinish = () => {
      this.stopOutputAudioAnalysis();
      (window as unknown as IWindow)._currentUtterance = null;
      if (onCompleted) {
        onCompleted();
      } else {
        this.onTTSFinished();
      }
    };

    utterance.onstart = () => {
      this.startCadenceFallback();
    };

    utterance.onboundary = () => {
      this.isAudioSpeaking = true;
      this.audioEnergy = 0.8;
      this.notify();
      setTimeout(() => {
        if (this.isSpeaking) {
          this.isAudioSpeaking = false;
          this.audioEnergy = 0.1;
          this.notify();
        }
      }, 100);
    };

    utterance.onend = onFinish;
    utterance.onerror = onFinish;

    const estimatedDuration = Math.max(3000, text.length * 85);
    this.ttsSafetyTimeout = setTimeout(() => {
      if (this.isSpeaking) {
        console.warn('[VOICE] TTS safety timeout triggered.');
        onFinish();
      }
    }, estimatedDuration);

    window.speechSynthesis.speak(utterance);
  }

  private stopTTSOutput(): void {
    if (this.outputAudioPlayer) {
      this.outputAudioPlayer.pause();
      this.outputAudioPlayer = null;
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    this.stopOutputAudioAnalysis();
  }

  private startCadenceFallback(): void {
    this.stopOutputAudioAnalysis();
    this.cadenceInterval = setInterval(() => {
      if (this.isSpeaking) {
        this.isAudioSpeaking = !this.isAudioSpeaking;
        this.audioEnergy = Math.random() * 0.45 + 0.35;
        this.notify();
      } else {
        this.stopOutputAudioAnalysis();
      }
    }, 160);
  }

  private stopOutputAudioAnalysis(): void {
    if (this.outputAnimFrame) {
      cancelAnimationFrame(this.outputAnimFrame);
      this.outputAnimFrame = null;
    }
    if (this.cadenceInterval) {
      clearInterval(this.cadenceInterval);
      this.cadenceInterval = null;
    }
    if (this.ttsSafetyTimeout) {
      clearTimeout(this.ttsSafetyTimeout);
      this.ttsSafetyTimeout = null;
    }
    this.isAudioSpeaking = false;
    this.audioEnergy = 0;
    this.notify();
  }

  // =========================================================================
  // AUTOMATIC RE-LISTEN AFTER TTS (CONTINUOUS HUMAN CONVERSATION)
  // =========================================================================

  private onTTSFinished(): void {
    console.log('[VOICE] TTS completed');
    this.isSpeaking = false;
    this.stopOutputAudioAnalysis();

    if (this.echoCooldownTimer) clearTimeout(this.echoCooldownTimer);

    // Continuous natural conversation re-arming:
    // When Life AI finishes speaking in the foreground, automatically re-listen after 650ms echo cooldown
    if (this.isVoiceModeEnabled && !this.isNative && this.isAppInForeground) {
      console.log('[VOICE] Cooldown (650ms)');
      this.setDetailedState('rearming');

      this.echoCooldownTimer = setTimeout(() => {
        if (this.isVoiceModeEnabled && !this.isSpeaking && this.isAppInForeground) {
          console.log('[VOICE] Listening rearmed');
          this.gateMicrophone(false);
          this.startQueryListening(); // Zero clicks needed: transitions automatically to LISTENING!
        }
      }, this.ECHO_COOLDOWN_MS);
    } else if (!this.isNative) {
      this.returnToWakeListening();
    }
  }

  private returnToWakeListening(): void {
    this.isSpeaking = false;
    this.isListeningSession = false;
    this.gateMicrophone(false);

    if (this.isVoiceModeEnabled && !this.isNative && this.isAppInForeground) {
      this.setDetailedState('ready');
      this.startWakeWordListening();
    } else {
      this.setDetailedState('idle');
    }
  }

  // =========================================================================
  // STOP VOICE
  // =========================================================================

  public stopVoice(): void {
    console.log('[VOICE] conversation stopped');
    this.isSpeaking = false;
    this.isListeningSession = false;
    this.isConversationActive = false;
    this.gateMicrophone(false);

    if (this.speechPauseTimer) clearTimeout(this.speechPauseTimer);
    if (this.conversationTimeoutTimer) clearTimeout(this.conversationTimeoutTimer);
    if (this.echoCooldownTimer) clearTimeout(this.echoCooldownTimer);

    this.stopTTSOutput();
    this.stopCurrentRecognition();

    if (this.isNative) {
      handsFreeService.stop().catch(() => {});
      this.isHandsFreeMode = false;
      this.setDetailedState('stopped');
      this.notify();
      return;
    }

    if (this.isVoiceModeEnabled && this.isAppInForeground) {
      this.setDetailedState('ready');
      this.startWakeWordListening();
    } else {
      this.setDetailedState('stopped');
      this.releaseMicrophoneStream();
    }
  }

  // =========================================================================
  // LOCAL VOICE TEST MODE (Diagnostic only — zero LLM / network calls)
  // =========================================================================

  public async startLocalVoiceTest(callback: (transcript: string, isFinal: boolean) => void): Promise<void> {
    console.log('[VOICE] Local voice diagnostic test mode started');
    this.isLocalTesting = true;
    this.localTestCallback = callback;
    this.recognitionMode = 'test';
    this.stopTTSOutput();
    this.stopCurrentRecognition();
    await this.ensureLiveMicrophoneStream();
    this.safeStartRecognition();
    this.notify();
  }

  public stopLocalVoiceTest(): void {
    console.log('[VOICE] Local voice diagnostic test mode stopped');
    this.isLocalTesting = false;
    this.localTestCallback = null;
    this.recognitionMode = 'query';
    this.stopCurrentRecognition();
    if (this.isVoiceModeEnabled && this.isAppInForeground) {
      this.startQueryListening();
    } else {
      this.setDetailedState('ready');
    }
    this.notify();
  }

  public isLocalVoiceTesting(): boolean {
    return this.isLocalTesting;
  }

  // =========================================================================
  // SETTINGS & TOGGLES
  // =========================================================================

  public setVoiceModeEnabled(enabled: boolean): void {
    this.isVoiceModeEnabled = enabled;
    localStorage.setItem('life_voice_mode_enabled', enabled ? 'true' : 'false');
    console.log(`[VOICE] mode set to: ${enabled}`);

    if (this.isNative) {
      if (enabled) {
        handsFreeService.start().then(() => handsFreeService.triggerListen()).catch(() => {});
      } else {
        handsFreeService.stop().catch(() => {});
        this.setDetailedState('disabled');
      }
      this.notify();
      return;
    }

    if (enabled) {
      this.onAppForeground();
    } else {
      this.stopVoice();
      this.setDetailedState('disabled');
      this.releaseMicrophoneStream();
    }
    this.notify();
  }

  public setWakeWordEnabled(enabled: boolean): void {
    this.isWakeWordEnabled = enabled;
    localStorage.setItem('life_wake_word_enabled', enabled ? 'true' : 'false');
    console.log(`[VOICE] wake word mode set to: ${enabled}`);

    if (enabled && this.isVoiceModeEnabled && !this.isConversationActive) {
      this.setDetailedState('wake_listening');
      this.startWakeWordListening();
    } else if (!enabled && !this.isConversationActive) {
      this.stopWakeWordListening();
    }
    this.notify();
  }

  public setHandsFreeMode(enabled: boolean): void {
    this.isHandsFreeMode = enabled;
    handsFreeService.setEnabledLocally(enabled);
    this.notify();
  }

  public setWakeWord(word: string): void {
    this.wakeWord = word;
    handsFreeService.setWakeWord(word);
    this.notify();
  }

  public setVoiceResponseEnabled(enabled: boolean): void {
    this.voiceResponseEnabled = enabled;
    handsFreeService.setVoiceResponseEnabled(enabled);
    this.notify();
  }

  public async requestMicPermission(): Promise<boolean> {
    if (this.isNative) {
      const granted = await handsFreeService.requestMicPermission();
      this.micPermissionGranted = granted;
      this.micPermissionError = !granted;
      this.notify();
      return granted;
    }
    try {
      await this.ensureLiveMicrophoneStream();
      if (this.isVoiceModeEnabled) {
        this.startQueryListening();
      }
      return true;
    } catch {
      return false;
    }
  }

  public async openNativeAppSettings(): Promise<void> {
    if (this.isNative) {
      await handsFreeService.openAppSettings();
    }
  }

  public async testMicrophoneInput(seconds: number = 3): Promise<Blob | null> {
    console.log(`[VOICE DIAGNOSTICS] Testing microphone for ${seconds}s...`);
    const stream = await this.ensureLiveMicrophoneStream();
    const chunks: Blob[] = [];
    const rec = new MediaRecorder(stream);
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    rec.start();

    await new Promise((r) => setTimeout(r, seconds * 1000));
    rec.stop();
    await new Promise((r) => {
      rec.onstop = () => r(null);
    });

    const blob = new Blob(chunks, { type: 'audio/webm' });
    console.log(`[VOICE DIAGNOSTICS] Test recorded blob size: ${blob.size} bytes`);
    return blob;
  }

  public async testBackendTranscription(audioBlob: Blob): Promise<string> {
    console.log('[VOICE DIAGNOSTICS] Testing backend Gemini STT endpoint...');
    const res = await api.transcribeAudio(audioBlob);
    console.log(`[VOICE DIAGNOSTICS] Backend transcription result: "${res.transcript}"`);
    return res.transcript;
  }

  // =========================================================================
  // NATIVE ANDROID INTEGRATION
  // =========================================================================

  private setupNativeListeners(): void {
    try {
      handsFreeService.addListener('voiceStateChanged', (data: { state: string }) => {
        const s = (data.state || '').toLowerCase();
        this.setDetailedState(s as DetailedVoiceState);
      });

      handsFreeService.addListener('transcriptUpdate', async (data: { transcript: string; isFinal: boolean }) => {
        this.transcript = data.transcript;
        this.notify();

        // When Android native SpeechRecognizer produces a final transcript,
        // intercept fast device intents locally (e.g. music: "Channa Mereya chalao", alarm: "6 baje alarm")
        if (data.isFinal && data.transcript && data.transcript.trim()) {
          const clean = data.transcript.trim();
          console.log(`[VOICE NATIVE] Final transcript from Android: "${clean}"`);
          try {
            const fastResult = await fastIntentRouter.route(clean);
            if (fastResult.handled) {
              console.log(`[VOICE NATIVE] Fast device intent executed locally: "${fastResult.responseText}"`);
              this.assistantResponse = fastResult.responseText;
              this.notify();
            }
          } catch (fastErr) {
            console.warn('[VOICE NATIVE] Fast intent error:', fastErr);
          }
        }
      });

      handsFreeService.addListener('assistantResponse', (data: { response: string; conversationId?: string; toolsExecuted?: string | any[] }) => {
        this.assistantResponse = data.response;
        if (data.conversationId) this.activeConversationId = data.conversationId;
        this.notify();

        if (data.toolsExecuted) {
          try {
            const tools = typeof data.toolsExecuted === 'string' ? JSON.parse(data.toolsExecuted) : data.toolsExecuted;
            console.log('[VOICE NATIVE] Executing server-returned tools:', tools);
            executeServerTools(tools).catch((toolErr) => {
              console.warn('[VOICE NATIVE] Tool execution notice:', toolErr);
            });
          } catch (parseErr) {
            console.warn('[VOICE NATIVE] Failed to parse toolsExecuted payload:', parseErr);
          }
        }
      });

      handsFreeService.addListener('rmsUpdate', (data: { rmsdB: number }) => {
        // Map native speech recognizer RMS dB into normalized [0.0, 1.0]
        const normalized = Math.max(0, Math.min(1.0, (data.rmsdB + 2) / 12));
        this.inputVolume = normalized;
        this.notify();
      });

      handsFreeService.addListener('voiceError', (data: { error: string }) => {
        console.error('[VOICE ERROR] Native error:', data.error);
        this.voiceError = data.error;
        if (data.error && (data.error.toLowerCase().includes('permission') || data.error.toLowerCase().includes('denied'))) {
          this.micPermissionError = true;
        }
        this.notify();
      });

      handsFreeService.isRunning().then((running) => {
        this.isHandsFreeMode = running;
        this.notify();
      });

      handsFreeService.checkBatteryOptimization().then((isExempt) => {
        this.isBatteryOptimizedExempt = isExempt;
        this.notify();
      });
    } catch (err) {
      console.warn('Native listener setup note:', err);
    }
  }

  public getAudioEnergy(): number {
    return this.audioEnergy;
  }

  public getIsAudioSpeaking(): boolean {
    return this.isAudioSpeaking;
  }

  public getInputVolume(): number {
    return this.inputVolume;
  }
}

export const voiceEngine = VoiceEngine.getInstance();
