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

  // Active Recognition Instance & Exclusive Locks
  private activeRecognition: any = null;
  private isTransitioning: boolean = false;
  private isRestarting: boolean = false;
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
  private readonly ECHO_COOLDOWN_MS = 750;
  private readonly END_SILENCE_MS = 950;
  private readonly CONVERSATION_SILENCE_TIMEOUT_MS = 16000;

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

    // Hook up native Android listeners if on native platform
    if (this.isNative) {
      this.setupNativeListeners();
      if (this.isVoiceModeEnabled) {
        console.log('[VOICE] Native platform: starting HandsFreeVoiceService automatically');
        handsFreeService.start().catch((err) => {
          console.warn('[VOICE] Automatic native start note:', err);
        });
      }
    } else {
      if (this.isVoiceModeEnabled) {
        console.log('[VOICE] mode enabled');
        this.setDetailedState('wake_listening');
        this.startWakeWordListening();
      } else {
        this.setDetailedState('disabled');
      }
    }

    this.notify();
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
      audioChannels: this.audioChannels
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
      case 'wake_listening':
      case 'idle':
      case 'disabled':
      case 'stopped':
      case 'recovering':
        this.voiceState = 'idle';
        break;
      case 'listening':
      case 'user_listening':
      case 'speech_detected':
      case 'rearming':
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
    this.notify();
  }

  // =========================================================================
  // PERSISTENT MICROPHONE MANAGEMENT
  // =========================================================================

  private async ensureLiveMicrophoneStream(): Promise<MediaStream> {
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
  // WAKE WORD LISTENER ("Hey Life")
  // =========================================================================

  public async startWakeWordListening(): Promise<void> {
    if (this.isNative || !this.isVoiceModeEnabled || this.isSpeaking || this.isListeningSession) {
      return;
    }

    if (this.isTransitioning) return;
    this.isTransitioning = true;

    if (this.wakeRecoveryTimer) {
      clearTimeout(this.wakeRecoveryTimer);
      this.wakeRecoveryTimer = null;
    }

    const SpeechRecognitionClass =
      (window as unknown as IWindow).SpeechRecognition ||
      (window as unknown as IWindow).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      this.isTransitioning = false;
      return;
    }

    try {
      await this.ensureLiveMicrophoneStream();
    } catch (err) {
      console.warn('[VOICE ERROR] mic stream check before wake listener:', err);
      this.isTransitioning = false;
      return;
    }

    this.stopCurrentRecognition();

    try {
      const wakeRec = new SpeechRecognitionClass();
      wakeRec.continuous = true;
      wakeRec.interimResults = true;
      wakeRec.lang = 'en-IN';

      wakeRec.onstart = () => {
        console.log('[VOICE] wake listener started');
        this.setDetailedState('wake_listening');
        this.isTransitioning = false;
      };

      wakeRec.onresult = (event: any) => {
        if (this.isSpeaking || this.isListeningSession || this.isMicGated) return;

        let transcriptText = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcriptText += event.results[i][0].transcript;
        }

        const lower = transcriptText.toLowerCase().trim();
        const targetWake = this.wakeWord.toLowerCase();

        if (
          lower.includes(targetWake) ||
          lower.includes('hey life') ||
          lower.includes('life') ||
          lower.includes('lyf') ||
          lower.includes('हे लाइफ') ||
          lower.includes('लाइफ') ||
          lower.includes('hey jeet') ||
          lower.includes('jeet') ||
          lower.includes('जीत')
        ) {
          console.log(`[VOICE] wake word detected: "${lower}"`);
          this.stopCurrentRecognition();
          this.handleWakeDetected();
        }
      };

      wakeRec.onerror = (e: any) => {
        if (e.error !== 'aborted' && e.error !== 'no-speech') {
          console.warn('[VOICE ERROR] wake listener error:', e.error);
        }
      };

      wakeRec.onend = () => {
        this.activeRecognition = null;
        // Auto-recover wake listener if still enabled and not in conversation/speaking/listening
        if (this.isVoiceModeEnabled && !this.isConversationActive && !this.isSpeaking && !this.isListeningSession && !this.isNative) {
          this.wakeRecoveryTimer = setTimeout(() => {
            if (this.isVoiceModeEnabled && !this.isConversationActive && !this.isSpeaking && !this.isListeningSession) {
              console.log('[VOICE] automatic restart (wake listener)');
              this.startWakeWordListening();
            }
          }, 300);
        }
      };

      this.activeRecognition = wakeRec;
      wakeRec.start();
    } catch (err: any) {
      this.isTransitioning = false;
      if (err.name !== 'InvalidStateError') {
        console.warn('[VOICE ERROR] wake listener start exception:', err);
      }
    }
  }

  public stopWakeWordListening(): void {
    if (this.wakeRecoveryTimer) {
      clearTimeout(this.wakeRecoveryTimer);
      this.wakeRecoveryTimer = null;
    }
    this.stopCurrentRecognition();
  }

  private stopCurrentRecognition(): void {
    if (this.activeRecognition) {
      try {
        this.activeRecognition.abort();
      } catch (_) {}
      this.activeRecognition = null;
    }
  }

  // =========================================================================
  // WAKE DETECTED -> GREETING ("Haan, bolo.") -> ENTER CONVERSATION
  // =========================================================================

  private async handleWakeDetected(): Promise<void> {
    console.log('[VOICE] conversation started');
    this.isConversationActive = true;
    this.setDetailedState('wake_detected');
    this.transcript = '';
    this.assistantResponse = '';
    this.voiceError = null;
    this.notify();

    // Play "Haan, bolo." with mic gated
    this.speakText('Haan, bolo.', () => {
      // Once greeting completes, transition immediately to active listening
      this.startQueryListening();
    });
  }

  // =========================================================================
  // QUERY LISTENING MODE (Continuous Multi-Turn Conversation)
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

    // Interruption: If currently speaking, stop TTS immediately and start listening (Barge-in)
    if (this.isSpeaking) {
      console.log('[VOICE] barge-in interruption triggered by user');
      this.stopTTSOutput();
      this.isSpeaking = false;
      this.gateMicrophone(false);
      this.isConversationActive = true;
      await this.startQueryListening();
      return;
    }

    // If already in an active listening session, pressing mic toggles voice conversation OFF
    if (this.isListeningSession) {
      console.log('[VOICE] conversation stopped by user action');
      this.stopVoice();
      return;
    }

    // Otherwise, start continuous voice conversation mode
    this.isConversationActive = true;
    this.isVoiceModeEnabled = true;
    localStorage.setItem('life_voice_mode_enabled', 'true');
    await this.startQueryListening();
  }

  private async startQueryListening(): Promise<void> {
    if (!this.isVoiceModeEnabled) return;

    this.stopWakeWordListening();
    this.gateMicrophone(false);

    this.isListeningSession = true;
    this.isRestarting = false;
    this.transcript = '';
    this.accumulatedTranscript = '';
    this.lastSpokenText = '';
    this.speechDetected = false;
    this.recordedChunks = [];
    this.voiceError = null;

    console.log('[VOICE] listening again');
    this.setDetailedState('listening');
    this.resetConversationSilenceTimeout();

    try {
      const stream = await this.ensureLiveMicrophoneStream();

      // Start MediaRecorder fallback buffer
      try {
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : '';

        const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            this.recordedChunks.push(e.data);
          }
        };
        recorder.start(200);
        this.mediaRecorder = recorder;
      } catch (recErr) {
        console.warn('[VOICE] MediaRecorder init note:', recErr);
      }

      // Initialize Web Speech Recognition
      const SpeechRecognitionClass =
        (window as unknown as IWindow).SpeechRecognition ||
        (window as unknown as IWindow).webkitSpeechRecognition;

      if (SpeechRecognitionClass) {
        const recognition = new SpeechRecognitionClass();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-IN';

        recognition.onstart = () => {
          console.log('[VOICE] speech recognition online');
        };

        recognition.onspeechstart = () => {
          if (!this.speechDetected) {
            console.log('[VOICE] speech started');
            this.speechDetected = true;
            this.speechStartTime = Date.now();
            this.setDetailedState('speech_detected');
          }
          if (this.conversationTimeoutTimer) clearTimeout(this.conversationTimeoutTimer);
        };

        recognition.onresult = (event: any) => {
          if (this.isMicGated || this.isSpeaking) return;

          let interim = '';
          let finalStr = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const text = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalStr += text;
            } else {
              interim += text;
            }
          }

          const currentText = (finalStr || interim).trim();
          if (currentText) {
            if (!this.speechDetected) {
              console.log('[VOICE] speech started');
              this.speechDetected = true;
              this.speechStartTime = Date.now();
              this.setDetailedState('speech_detected');
            }

            this.accumulatedTranscript = currentText;
            this.lastSpokenText = currentText;
            this.transcript = currentText;
            this.notify();

            // Clear conversation inactivity timeout while user is talking
            if (this.conversationTimeoutTimer) clearTimeout(this.conversationTimeoutTimer);

            // Speech-end VAD detection: Auto-submit after 950ms of silence following speech
            if (this.speechPauseTimer) clearTimeout(this.speechPauseTimer);
            this.speechPauseTimer = setTimeout(() => {
              if (this.isListeningSession) {
                console.log('[VOICE] speech ended');
                console.log('[VOICE] transcription started');
                this.stopListeningSession();
              }
            }, this.END_SILENCE_MS);
          }
        };

        recognition.onerror = (e: any) => {
          if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
            console.error('[VOICE ERROR] microphone error: permission denied');
            this.micPermissionError = true;
            this.voiceError = 'Microphone permission required.';
            this.setDetailedState('error');
          } else if (e.error !== 'aborted' && e.error !== 'no-speech') {
            console.warn('[VOICE ERROR] speech recognition error:', e.error);
          }
        };

        recognition.onend = () => {
          // If recognition ended unexpectedly while in active listening (e.g. browser silence timeout)
          if (this.isListeningSession && !this.isSpeaking && this.isConversationActive && !this.isRestarting) {
            console.log('[VOICE] recognition ended unexpectedly');
            this.isRestarting = true;
            setTimeout(() => {
              if (this.isListeningSession && !this.isSpeaking && this.isConversationActive) {
                console.log('[VOICE] automatic restart');
                this.startQueryListening();
              }
            }, 250);
          }
        };

        this.activeRecognition = recognition;
        recognition.start();
      }
    } catch (err: any) {
      console.error('[VOICE ERROR] query listen start failed:', err);
      this.isListeningSession = false;
      this.returnToWakeListening();
    }
  }

  // Conversation silence timeout: after 16s of silence with zero speech, gracefully return to wake-word standby
  private resetConversationSilenceTimeout(): void {
    if (this.conversationTimeoutTimer) clearTimeout(this.conversationTimeoutTimer);
    this.conversationTimeoutTimer = setTimeout(() => {
      if (this.isListeningSession && !this.speechDetected && !this.isSpeaking) {
        console.log('[VOICE] conversation session timed out due to inactivity');
        this.isConversationActive = false;
        this.stopCurrentRecognition();
        this.returnToWakeListening();
      }
    }, this.CONVERSATION_SILENCE_TIMEOUT_MS);
  }

  private async stopListeningSession(): Promise<void> {
    if (this.speechPauseTimer) clearTimeout(this.speechPauseTimer);
    if (this.conversationTimeoutTimer) clearTimeout(this.conversationTimeoutTimer);

    this.isListeningSession = false;

    // Stop Web Speech recognition
    if (this.activeRecognition) {
      try {
        this.activeRecognition.stop();
      } catch (_) {}
    }
    await new Promise((r) => setTimeout(r, 200));

    // Grab audio blob from MediaRecorder
    let recordedBlob: Blob | null = null;
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        await new Promise<void>((resolve) => {
          if (!this.mediaRecorder) return resolve();
          this.mediaRecorder.onstop = () => resolve();
          this.mediaRecorder.stop();
        });
        if (this.recordedChunks.length > 0) {
          recordedBlob = new Blob(this.recordedChunks, { type: 'audio/webm' });
        }
      } catch (recErr) {
        console.warn('[VOICE] MediaRecorder stop note:', recErr);
      }
    }

    let candidateTranscript = (this.lastSpokenText || this.accumulatedTranscript || this.transcript || '').trim();

    // Fallback: If Web Speech yielded no text but speech was recorded, invoke Gemini Multimodal STT
    if (!candidateTranscript && recordedBlob && recordedBlob.size > 800) {
      console.log('[VOICE] Web Speech yielded no transcript. Invoking backend Gemini Multimodal STT fallback...');
      this.setDetailedState('transcribing');
      try {
        const backendRes = await api.transcribeAudio(recordedBlob);
        if (backendRes && backendRes.transcript && backendRes.transcript.trim()) {
          candidateTranscript = backendRes.transcript.trim();
          this.transcript = candidateTranscript;
        }
      } catch (sttErr: any) {
        console.warn('[VOICE ERROR] STT backend error:', sttErr);
      }
    }

    if (candidateTranscript) {
      console.log(`[VOICE] transcript: "${candidateTranscript}"`);
      this.transcript = candidateTranscript;
      this.notify();

      // Check for user goodbye / stop phrases
      const lowerCandidate = candidateTranscript.toLowerCase();
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
        this.speakText('Theek hai, alvida! Jab bhi zaroorat ho, bas "Hey Life" keh dena.', () => {
          this.returnToWakeListening();
        });
        return;
      }

      await this.handleUserUtterance(candidateTranscript);
    } else {
      console.log('[VOICE] empty transcript detected (silence)');
      if (this.isConversationActive) {
        // In continuous conversation, restart listening gracefully
        this.startQueryListening();
      } else {
        this.returnToWakeListening();
      }
    }
  }

  // =========================================================================
  // AI PROCESSING & AGENT REQUEST
  // =========================================================================

  private async handleUserUtterance(userText: string): Promise<void> {
    if (!userText || this.isSpeaking) return;
    const cleanText = userText.trim();
    if (!cleanText) return;

    // Fast Device Intent Interception (Alarms & Music controls executed locally in <50ms)
    try {
      const fastResult = await fastIntentRouter.route(cleanText);
      if (fastResult.handled) {
        console.log(`[VOICE] fast intent handled locally: "${fastResult.responseText}"`);
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

    console.log('[VOICE] request started');
    this.setDetailedState('thinking');

    try {
      const res = await api.sendMessage({
        content: cleanText,
        conversation_id: this.activeConversationId || undefined,
        timezone: 'Asia/Kolkata',
        voice_mode: true
      });

      console.log(`[VOICE] first response received: "${(res.response || '').substring(0, 50)}..."`);
      this.activeConversationId = res.conversation_id;
      this.assistantResponse = res.response;
      this.voiceError = null;
      this.notify();

      // Execute server-directed tools (e.g. music play, alarm scheduling)
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

    // Connect to AudioContext Analyser for synchronized avatar lip-sync
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
    const indianFemaleVoice =
      voices.find(
        (v) =>
          (v.lang.toLowerCase().includes('in') ||
            v.name.toLowerCase().includes('india') ||
            v.name.toLowerCase().includes('hindi')) &&
          (v.name.toLowerCase().includes('swara') ||
            v.name.toLowerCase().includes('neerja') ||
            v.name.toLowerCase().includes('ananya') ||
            v.name.toLowerCase().includes('heera') ||
            v.name.toLowerCase().includes('kalpana') ||
            (v as any).gender === 'female')
      ) ||
      voices.find(
        (v) =>
          v.name.toLowerCase().includes('zira') ||
          v.name.toLowerCase().includes('female') ||
          (v as any).gender === 'female' ||
          v.lang.toLowerCase() === 'hi-in' ||
          v.lang.toLowerCase() === 'en-in'
      );

    if (indianFemaleVoice) {
      utterance.voice = indianFemaleVoice;
      utterance.lang = indianFemaleVoice.lang;
    } else {
      utterance.lang = 'hi-IN';
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
    console.log('[VOICE] TTS finished');
    this.isSpeaking = false;
    this.stopOutputAudioAnalysis();

    if (this.echoCooldownTimer) clearTimeout(this.echoCooldownTimer);

    // If conversation mode is active, automatically re-arm microphone after echo protection
    if (this.isConversationActive && this.isVoiceModeEnabled && !this.isNative) {
      console.log('[VOICE] echo cooldown started');
      this.setDetailedState('rearming');

      this.echoCooldownTimer = setTimeout(() => {
        if (this.isConversationActive && this.isVoiceModeEnabled && !this.isSpeaking) {
          console.log('[VOICE] microphone rearmed');
          this.gateMicrophone(false);
          this.startQueryListening(); // Automatically transitions to LISTENING for next utterance!
        }
      }, this.ECHO_COOLDOWN_MS);
    } else {
      this.returnToWakeListening();
    }
  }

  private returnToWakeListening(): void {
    this.isSpeaking = false;
    this.isListeningSession = false;
    this.gateMicrophone(false);

    if (this.isVoiceModeEnabled && !this.isNative) {
      this.setDetailedState('wake_listening');
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

    if (this.isVoiceModeEnabled) {
      this.setDetailedState('wake_listening');
      this.startWakeWordListening();
    } else {
      this.setDetailedState('stopped');
      this.releaseMicrophoneStream();
    }
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
        handsFreeService.start().catch(() => {});
      } else {
        handsFreeService.stop().catch(() => {});
        this.setDetailedState('disabled');
      }
      this.notify();
      return;
    }

    if (enabled) {
      this.setDetailedState('wake_listening');
      this.startWakeWordListening();
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

      handsFreeService.addListener('transcriptUpdate', (data: { transcript: string; isFinal: boolean }) => {
        this.transcript = data.transcript;
        this.notify();
      });

      handsFreeService.addListener('assistantResponse', (data: { response: string; conversationId?: string }) => {
        this.assistantResponse = data.response;
        if (data.conversationId) this.activeConversationId = data.conversationId;
        this.notify();
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
