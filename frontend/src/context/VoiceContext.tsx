import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { VoiceState, DetailedVoiceState } from '../types';
import { api, getServerHostUrl } from '../services/api';
import { handsFreeService } from '../services/handsFreeService';

export interface VoiceDiagnosticsState {
  micAvailable: boolean;
  permissionGranted: boolean;
  permissionDenied: boolean;
  streamActive: boolean;
  sampleRate: number;
  channels: number;
  inputVolume: number;
  sttEngine: 'web_speech' | 'gemini_multimodal' | 'unavailable';
  sttSupported: boolean;
  wakeWordListening: boolean;
  backendConnected: boolean;
  ttsReady: boolean;
  lastError: string | null;
}

interface VoiceContextType {
  voiceState: VoiceState;
  detailedVoiceState: DetailedVoiceState;
  transcript: string;
  assistantResponse: string;
  voiceError: string | null;
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
  isDiagnosticsOpen: boolean;
  setIsDiagnosticsOpen: (open: boolean) => void;
  diagnostics: VoiceDiagnosticsState;
  toggleWakeWord: () => void;
  toggleHandsFreeMode: () => Promise<void>;
  updateWakeWord: (word: string) => void;
  updateVoiceResponse: (enabled: boolean) => void;
  triggerManualListen: () => Promise<void>;
  stopVoice: () => void;
  playAudioResponse: (url: string, fallbackText?: string) => void;
  requestMicPermission: () => Promise<boolean>;
  checkBatteryOptimization: () => Promise<boolean>;
  requestBatteryOptimizationExemption: () => Promise<void>;
  testMicrophoneInput: (seconds?: number) => Promise<Blob | null>;
  testBackendTranscription: (audioBlob: Blob) => Promise<string>;
}

const VoiceContext = createContext<VoiceContextType | undefined>(undefined);

interface IWindow extends Window {
  webkitSpeechRecognition: any;
  SpeechRecognition: any;
  _currentUtterance?: any;
}

export const VoiceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Voice states
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [detailedVoiceState, setDetailedVoiceState] = useState<DetailedVoiceState>('stopped');
  const [transcript, setTranscript] = useState<string>('');
  const [assistantResponse, setAssistantResponse] = useState<string>('');
  const [voiceError, setVoiceError] = useState<string | null>(null);

  // Settings & Toggles
  const [isWakeWordEnabled, setIsWakeWordEnabled] = useState<boolean>(true);
  const [isHandsFreeMode, setIsHandsFreeMode] = useState<boolean>(handsFreeService.isEnabledLocally());
  const [wakeWord, setWakeWordState] = useState<string>(handsFreeService.getWakeWord());
  const [voiceResponseEnabled, setVoiceResponseState] = useState<boolean>(handsFreeService.isVoiceResponseEnabled());
  const [micPermissionError, setMicPermissionError] = useState<boolean>(false);
  const [micPermissionGranted, setMicPermissionGranted] = useState<boolean>(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isBatteryOptimizedExempt, setIsBatteryOptimizedExempt] = useState<boolean>(true);

  // Audio meters
  const [isAudioSpeaking, setIsAudioSpeaking] = useState<boolean>(false);
  const [audioEnergy, setAudioEnergy] = useState<number>(0);
  const [inputVolume, setInputVolume] = useState<number>(0);

  // Diagnostics & Connectivity
  const [sttEngine, setSttEngine] = useState<'web_speech' | 'gemini_multimodal' | 'unavailable'>('web_speech');
  const [isBackendOnline, setIsBackendOnline] = useState<boolean>(true);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState<boolean>(false);
  const [streamActive, setStreamActive] = useState<boolean>(false);
  const [audioSampleRate, setAudioSampleRate] = useState<number>(0);
  const [audioChannels, setAudioChannels] = useState<number>(0);

  const isNative = handsFreeService.isNativeAvailable();

  // Internal Execution Refs
  const recognitionRef = useRef<any>(null);
  const wakeRecognitionRef = useRef<any>(null);
  const isListeningRef = useRef<boolean>(false);
  const isSpeakingRef = useRef<boolean>(false);
  const isMicGatedRef = useRef<boolean>(false);
  const isWakeActiveRef = useRef<boolean>(false);
  const wakeRestartTimerRef = useRef<any>(null);

  // Spoken Text Accumulation Refs (immune to stale React closures)
  const transcriptRef = useRef<string>('');
  const lastSpokenTextRef = useRef<string>('');
  const finalTranscriptRef = useRef<string>('');
  const speechDetectedRef = useRef<boolean>(false);
  const lastSpeechTimeRef = useRef<number>(0);
  const lastVolUpdateRef = useRef<number>(0);

  // Media & Recording Refs
  const activeStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const inputAnalyserRef = useRef<AnalyserNode | null>(null);
  const inputAnimFrameRef = useRef<number | null>(null);

  // TTS Output Refs
  const outputAudioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAnimFrameRef = useRef<number | null>(null);
  const cadenceIntervalRef = useRef<any>(null);
  const ttsSafetyTimeoutRef = useRef<any>(null);

  // Timers
  const silenceTimerRef = useRef<any>(null);
  const speechPauseTimerRef = useRef<any>(null);

  // Check STT capability on mount
  useEffect(() => {
    const SpeechRecognitionClass =
      (window as unknown as IWindow).SpeechRecognition ||
      (window as unknown as IWindow).webkitSpeechRecognition;

    if (SpeechRecognitionClass) {
      setSttEngine('web_speech');
      console.log('[VOICE] STT Engine detected: Web Speech API supported.');
    } else {
      setSttEngine('gemini_multimodal');
      console.log('[VOICE] STT Engine: Web Speech API not detected, defaulting to Gemini Multimodal STT.');
    }

    // Ping backend health
    api.checkHealth()
      .then(() => setIsBackendOnline(true))
      .catch(() => setIsBackendOnline(false));
  }, []);

  // Stop output audio analysis
  const stopOutputAudioAnalysis = () => {
    if (outputAnimFrameRef.current) {
      cancelAnimationFrame(outputAnimFrameRef.current);
      outputAnimFrameRef.current = null;
    }
    if (cadenceIntervalRef.current) {
      clearInterval(cadenceIntervalRef.current);
      cadenceIntervalRef.current = null;
    }
    if (ttsSafetyTimeoutRef.current) {
      clearTimeout(ttsSafetyTimeoutRef.current);
      ttsSafetyTimeoutRef.current = null;
    }
    setIsAudioSpeaking(false);
    setAudioEnergy(0);
  };

  const startCadenceFallback = () => {
    stopOutputAudioAnalysis();
    cadenceIntervalRef.current = setInterval(() => {
      if (isSpeakingRef.current) {
        setIsAudioSpeaking(prev => !prev);
        setAudioEnergy(Math.random() * 0.45 + 0.35);
      } else {
        stopOutputAudioAnalysis();
      }
    }, 160);
  };

  // Stop input mic audio analysis
  const stopInputAudioAnalysis = () => {
    if (inputAnimFrameRef.current) {
      cancelAnimationFrame(inputAnimFrameRef.current);
      inputAnimFrameRef.current = null;
    }
    setInputVolume(0);
  };

  // Close & release active microphone stream
  const releaseActiveMediaStream = useCallback(() => {
    stopInputAudioAnalysis();
    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      activeStreamRef.current = null;
      setStreamActive(false);
      console.log('[VOICE] microphone stream stopped and tracks released');
    }
  }, []);

  // Sync with native Android HandsFreeVoice service events when running inside Android APK
  useEffect(() => {
    if (!isNative) {
      setDetailedVoiceState(isWakeWordEnabled ? 'wake_listening' : 'stopped');
      return;
    }

    let subState: any;
    let subTranscript: any;
    let subResponse: any;
    let subError: any;

    const setupNativeListeners = async () => {
      try {
        subState = await handsFreeService.addListener('voiceStateChanged', (data: { state: string }) => {
          const s = (data.state || '').toLowerCase();
          setDetailedVoiceState(s as DetailedVoiceState);

          switch (s) {
            case 'wake_listening':
              setVoiceState('idle');
              break;
            case 'wake_detected':
            case 'greeting':
            case 'tts':
            case 'speaking':
              setVoiceState('speaking');
              break;
            case 'user_listening':
            case 'listening':
            case 'cooldown':
              setVoiceState('listening');
              break;
            case 'processing':
              setVoiceState('thinking');
              break;
            case 'error':
              setVoiceState('error');
              break;
            case 'stopped':
            default:
              setVoiceState('idle');
              break;
          }
        });

        subTranscript = await handsFreeService.addListener('transcriptUpdate', (data: { transcript: string; isFinal: boolean }) => {
          setTranscript(data.transcript);
          transcriptRef.current = data.transcript;
        });

        subResponse = await handsFreeService.addListener('assistantResponse', (data: { response: string; conversationId?: string }) => {
          setAssistantResponse(data.response);
          if (data.conversationId) {
            setActiveConversationId(data.conversationId);
          }
        });

        subError = await handsFreeService.addListener('voiceError', (data: { error: string }) => {
          console.error('[VOICE ERROR] Native error:', data.error);
          setVoiceError(data.error);
          if (data.error && (data.error.toLowerCase().includes('permission') || data.error.toLowerCase().includes('denied'))) {
            setMicPermissionError(true);
          }
        });

        const running = await handsFreeService.isRunning();
        setIsHandsFreeMode(running);
        const curState = await handsFreeService.getState();
        setDetailedVoiceState(curState as DetailedVoiceState);
        const isExempt = await handsFreeService.checkBatteryOptimization();
        setIsBatteryOptimizedExempt(isExempt);
      } catch (err) {
        console.warn('Native listener setup note:', err);
      }
    };

    setupNativeListeners();

    return () => {
      if (subState?.remove) subState.remove();
      if (subTranscript?.remove) subTranscript.remove();
      if (subResponse?.remove) subResponse.remove();
      if (subError?.remove) subError.remove();
    };
  }, [isNative, isWakeWordEnabled]);

  const checkBatteryOptimization = async (): Promise<boolean> => {
    if (isNative) {
      const isExempt = await handsFreeService.checkBatteryOptimization();
      setIsBatteryOptimizedExempt(isExempt);
      return isExempt;
    }
    return true;
  };

  const requestBatteryOptimizationExemption = async (): Promise<void> => {
    if (isNative) {
      await handsFreeService.requestIgnoreBatteryOptimization();
      setTimeout(async () => {
        const isExempt = await handsFreeService.checkBatteryOptimization();
        setIsBatteryOptimizedExempt(isExempt);
      }, 1500);
    }
  };

  // Acquire active microphone stream & setup throttled real-time AudioContext energy meter
  const startLiveMicrophoneStream = async (): Promise<MediaStream> => {
    console.log('[VOICE] checking microphone permission');
    setDetailedVoiceState('starting_mic');

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
      console.log('[VOICE] microphone stream started');
      activeStreamRef.current = stream;
      setMicPermissionGranted(true);
      setMicPermissionError(false);
      setStreamActive(true);

      const trackSettings = audioTracks[0].getSettings ? audioTracks[0].getSettings() : {};
      setAudioSampleRate(trackSettings.sampleRate || 48000);
      setAudioChannels(trackSettings.channelCount || 1);

      // Connect to AudioContext for live decibel / energy metering
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          if (!inputAudioCtxRef.current || inputAudioCtxRef.current.state === 'closed') {
            inputAudioCtxRef.current = new AudioCtx();
          }
          if (inputAudioCtxRef.current.state === 'suspended') {
            await inputAudioCtxRef.current.resume();
          }

          const ctx = inputAudioCtxRef.current;
          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          analyser.smoothingTimeConstant = 0.3;
          source.connect(analyser);
          inputAnalyserRef.current = analyser;

          const dataArray = new Uint8Array(analyser.frequencyBinCount);

          const sampleInputAudio = () => {
            if (!activeStreamRef.current || isMicGatedRef.current) {
              setInputVolume(0);
              inputAnimFrameRef.current = requestAnimationFrame(sampleInputAudio);
              return;
            }

            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const avg = sum / dataArray.length;
            // Normalize volume 0.0 to 1.0 with responsive curve
            const vol = Math.min(1.0, (avg / 128) * 1.8);

            // Throttle UI state update to ~12 FPS to avoid React re-render flooding!
            const now = performance.now();
            if (now - lastVolUpdateRef.current > 80) {
              lastVolUpdateRef.current = now;
              setInputVolume(vol);
            }

            // Speech threshold detection (> 0.07 energy)
            if (vol > 0.07) {
              if (!speechDetectedRef.current) {
                console.log(`[VOICE] speech detected (mic volume: ${(vol * 100).toFixed(0)}%)`);
                speechDetectedRef.current = true;
                setDetailedVoiceState('speech_detected');
              }
              lastSpeechTimeRef.current = Date.now();
            }

            inputAnimFrameRef.current = requestAnimationFrame(sampleInputAudio);
          };

          inputAnimFrameRef.current = requestAnimationFrame(sampleInputAudio);
        }
      } catch (audioCtxErr) {
        console.warn('[VOICE] Input AudioContext analysis note:', audioCtxErr);
      }

      return stream;
    } catch (err: any) {
      console.error('[VOICE ERROR] Microphone permission or capture failed:', err);
      setMicPermissionError(true);
      setMicPermissionGranted(false);
      setStreamActive(false);
      setVoiceError(err.message || 'Microphone access denied');
      setDetailedVoiceState('error');
      setVoiceState('error');
      throw err;
    }
  };

  // Explicit mic permission request
  const requestMicPermission = async (): Promise<boolean> => {
    try {
      if (isNative) {
        await handsFreeService.start();
        setIsHandsFreeMode(true);
        setMicPermissionError(false);
        setMicPermissionGranted(true);
        return true;
      } else {
        await startLiveMicrophoneStream();
        if (!isListeningRef.current) {
          releaseActiveMediaStream();
        }
        return true;
      }
    } catch (err) {
      setMicPermissionError(true);
      return false;
    }
  };

  // Reset silence timeout: after 8 seconds of absolute silence, return to idle
  const resetSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(() => {
      console.log('[VOICE] silence timeout reached. stopping listening gracefully.');
      if (isListeningRef.current && !isSpeakingRef.current) {
        stopListeningSession(false);
      }
    }, 8000);
  }, []);

  // Stop any active Web Speech recognition instance
  const stopRecognitionGracefully = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (_) {}
      recognitionRef.current = null;
    }
    isListeningRef.current = false;
  };

  // Stop wake word listener cleanly
  const stopWakeWordListener = () => {
    isWakeActiveRef.current = false;
    if (wakeRestartTimerRef.current) {
      clearTimeout(wakeRestartTimerRef.current);
      wakeRestartTimerRef.current = null;
    }
    if (wakeRecognitionRef.current) {
      try {
        wakeRecognitionRef.current.abort();
      } catch (_) {}
      wakeRecognitionRef.current = null;
    }
  };

  // Stop listening session and process results
  const stopListeningSession = async (userRequestedStop: boolean = false) => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (speechPauseTimerRef.current) clearTimeout(speechPauseTimerRef.current);

    // Stop Web Speech recognition and allow 200ms to flush final speech events
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
    }
    await new Promise(r => setTimeout(r, 200));

    isListeningRef.current = false;
    console.log('[VOICE] speech recognition ended');

    // Stop MediaRecorder and grab audio blob if available
    let recordedBlob: Blob | null = null;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        await new Promise<void>((resolve) => {
          if (!mediaRecorderRef.current) return resolve();
          mediaRecorderRef.current.onstop = () => resolve();
          mediaRecorderRef.current.stop();
        });
        if (recordedChunksRef.current.length > 0) {
          recordedBlob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
          console.log(`[VOICE] MediaRecorder captured audio blob (${recordedBlob.size} bytes)`);
        }
      } catch (recErr) {
        console.warn('[VOICE] MediaRecorder stop note:', recErr);
      }
    }

    releaseActiveMediaStream();

    // Evaluate transcript using all accumulated refs (immune to stale React closures)
    let candidateTranscript = (
      lastSpokenTextRef.current ||
      transcriptRef.current ||
      finalTranscriptRef.current ||
      ''
    ).trim();

    // If Web Speech yielded nothing but real speech was recorded, invoke Gemini STT fallback
    if (!candidateTranscript && recordedBlob && recordedBlob.size > 800) {
      console.log('[VOICE] Web Speech yielded no transcript. Invoking backend Gemini Multimodal STT fallback...');
      setDetailedVoiceState('transcribing');
      try {
        const backendRes = await api.transcribeAudio(recordedBlob);
        if (backendRes && backendRes.transcript && backendRes.transcript.trim()) {
          candidateTranscript = backendRes.transcript.trim();
          console.log(`[VOICE] transcript received (Gemini STT): "${candidateTranscript}"`);
          setTranscript(candidateTranscript);
          transcriptRef.current = candidateTranscript;
        }
      } catch (sttErr: any) {
        console.warn('[VOICE ERROR] Gemini STT transcription error:', sttErr);
      }
    }

    // Process Result
    if (candidateTranscript) {
      console.log(`[VOICE] Final transcript to submit: "${candidateTranscript}"`);
      setTranscript(candidateTranscript);
      await handleUserUtterance(candidateTranscript);
    } else {
      console.log('[VOICE] empty transcript detected (user was silent)');
      setTranscript('');
      transcriptRef.current = '';
      lastSpokenTextRef.current = '';
      setAssistantResponse("I couldn't hear that. Please try again.");
      setVoiceState('idle');
      setDetailedVoiceState(isWakeWordEnabled ? 'wake_listening' : 'idle');

      // Safely resume wake listening if enabled
      if (isWakeWordEnabled && !isSpeakingRef.current && !isNative) {
        setTimeout(() => {
          startWakeWordListener();
        }, 500);
      }
    }
  };

  // Start manual voice interaction (mic button tapped)
  const triggerManualListen = async () => {
    console.log('[VOICE] microphone button pressed');

    if (isNative) {
      try {
        await handsFreeService.start();
        setIsHandsFreeMode(true);
        setMicPermissionError(false);
      } catch (err: any) {
        console.error('[VOICE ERROR] Failed to trigger native listen:', err);
        setMicPermissionError(true);
      }
      return;
    }

    // If currently speaking, stop TTS output immediately
    if (isSpeakingRef.current) {
      stopVoice();
      return;
    }

    // If currently listening, tap finishes utterance manually
    if (isListeningRef.current) {
      await stopListeningSession(true);
      return;
    }

    // IMMEDIATELY terminate wake word listener to prevent any race condition!
    stopWakeWordListener();
    isListeningRef.current = true;

    // Reset transcription state and refs
    setTranscript('');
    setAssistantResponse('');
    setVoiceError(null);
    transcriptRef.current = '';
    finalTranscriptRef.current = '';
    lastSpokenTextRef.current = '';
    speechDetectedRef.current = false;
    recordedChunksRef.current = [];

    try {
      // 1. Acquire live microphone stream
      const stream = await startLiveMicrophoneStream();

      // 2. Start MediaRecorder fallback buffer
      try {
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : '';

        const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            recordedChunksRef.current.push(e.data);
          }
        };
        recorder.start(200);
        mediaRecorderRef.current = recorder;
        console.log('[VOICE] audio capture started (MediaRecorder recording active)');
      } catch (recStartErr) {
        console.warn('[VOICE] MediaRecorder init note:', recStartErr);
      }

      // 3. Initialize Web Speech Recognition in continuous mode for queries
      const SpeechRecognitionClass =
        (window as unknown as IWindow).SpeechRecognition ||
        (window as unknown as IWindow).webkitSpeechRecognition;

      if (SpeechRecognitionClass) {
        const recognition = new SpeechRecognitionClass();
        recognition.continuous = true; // Stay active across brief speech pauses
        recognition.interimResults = true;
        recognition.lang = 'en-IN'; // Indian accents, Hindi & Hinglish

        recognition.onstart = () => {
          isListeningRef.current = true;
          console.log('[VOICE] speech recognition started');
          setVoiceState('listening');
          setDetailedVoiceState('listening');
          resetSilenceTimer();
        };

        recognition.onspeechstart = () => {
          console.log('[VOICE] speech detected by recognition engine');
          speechDetectedRef.current = true;
          setDetailedVoiceState('speech_detected');
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        };

        recognition.onresult = (event: any) => {
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
            console.log(`[VOICE] interim transcript: "${currentText}"`);
            transcriptRef.current = currentText;
            lastSpokenTextRef.current = currentText;
            setTranscript(currentText);

            if (finalStr) {
              finalTranscriptRef.current = finalStr;
              console.log(`[VOICE] transcript piece finalized: "${finalStr}"`);
            }

            // User is actively speaking: clear silence timeout
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

            // Auto-submit when user pauses speaking for 1.3 seconds
            if (speechPauseTimerRef.current) clearTimeout(speechPauseTimerRef.current);
            speechPauseTimerRef.current = setTimeout(() => {
              if (isListeningRef.current) {
                console.log('[VOICE] user pause detected after speech. Completing utterance...');
                stopListeningSession();
              }
            }, 1300);
          }
        };

        recognition.onerror = (e: any) => {
          console.warn(`[VOICE ERROR] Speech recognition error: ${e.error}`);
          if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
            setMicPermissionError(true);
            setVoiceError('Microphone permission denied by browser.');
          }
        };

        recognition.onend = () => {
          if (isListeningRef.current) {
            stopListeningSession();
          }
        };

        recognitionRef.current = recognition;
        try {
          recognition.start();
        } catch (startErr: any) {
          if (startErr.name !== 'InvalidStateError') {
            console.warn('[VOICE] Recognition start error:', startErr);
          }
          setVoiceState('listening');
          setDetailedVoiceState('listening');
          resetSilenceTimer();
        }
      } else {
        // Fallback for browsers without Web Speech
        isListeningRef.current = true;
        setVoiceState('listening');
        setDetailedVoiceState('listening');
        resetSilenceTimer();

        // Check pause via AudioContext speech detector
        const checkSpeechDoneInterval = setInterval(() => {
          if (!isListeningRef.current) {
            clearInterval(checkSpeechDoneInterval);
            return;
          }
          if (speechDetectedRef.current && Date.now() - lastSpeechTimeRef.current > 1500) {
            clearInterval(checkSpeechDoneInterval);
            console.log('[VOICE] Speech pause detected via audio energy analyzer. Stopping...');
            stopListeningSession();
          }
        }, 200);
      }
    } catch (err: any) {
      console.error('[VOICE ERROR] Failed to start manual listen:', err);
      isListeningRef.current = false;
      setVoiceState('idle');
      setDetailedVoiceState(isWakeWordEnabled ? 'wake_listening' : 'idle');
    }
  };

  // Continuous Wake Word Listener ("Hey Life" / "Life" / "Jeet")
  const startWakeWordListener = useCallback(() => {
    if (isNative || !isWakeWordEnabled || isListeningRef.current || isSpeakingRef.current) return;

    const SpeechRecognitionClass =
      (window as unknown as IWindow).SpeechRecognition ||
      (window as unknown as IWindow).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) return;

    // Ensure query recognition is closed
    stopRecognitionGracefully();
    isWakeActiveRef.current = true;

    try {
      const wakeRec = new SpeechRecognitionClass();
      wakeRec.continuous = true;
      wakeRec.interimResults = true;
      wakeRec.lang = 'en-IN';

      wakeRec.onstart = () => {
        console.log('[WAKE] listener initialized');
        console.log('[WAKE] microphone active');
        console.log('[WAKE] listening');
        setDetailedVoiceState('wake_listening');
      };

      wakeRec.onresult = (event: any) => {
        if (!isWakeActiveRef.current || isListeningRef.current) return;

        let transcriptText = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcriptText += event.results[i][0].transcript;
        }

        const lower = transcriptText.toLowerCase().trim();
        const targetWake = wakeWord.toLowerCase();

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
          console.log(`[WAKE] phrase detected: "${lower}"`);
          console.log('[WAKE] callback fired');
          console.log('[WAKE] entering listening state');

          stopWakeWordListener();
          handleWakeWordTriggered();
        }
      };

      wakeRec.onerror = (e: any) => {
        if (e.error !== 'aborted' && e.error !== 'no-speech') {
          console.warn('[WAKE] error:', e.error);
        }
      };

      wakeRec.onend = () => {
        // Only recover if wake mode is still active and user is not speaking/listening
        if (isWakeActiveRef.current && isWakeWordEnabled && !isListeningRef.current && !isSpeakingRef.current && !isNative) {
          wakeRestartTimerRef.current = setTimeout(() => {
            if (isWakeActiveRef.current && !isListeningRef.current && !isSpeakingRef.current) {
              startWakeWordListener();
            }
          }, 800);
        }
      };

      wakeRecognitionRef.current = wakeRec;
      wakeRec.start();
    } catch (err: any) {
      if (err.name !== 'InvalidStateError') {
        console.warn('[WAKE] start note:', err);
      }
    }
  }, [isNative, isWakeWordEnabled, wakeWord]);

  // Start wake listener only once on mount or when wake toggle changes
  useEffect(() => {
    if (isWakeWordEnabled && !isNative && !isListeningRef.current && !isSpeakingRef.current) {
      startWakeWordListener();
    } else {
      stopWakeWordListener();
    }

    return () => {
      stopWakeWordListener();
    };
  }, [isWakeWordEnabled, isNative]); // Exclude startWakeWordListener from dependencies to prevent infinite re-renders!

  // When wake word triggers: speak fast greeting and listen for query
  const handleWakeWordTriggered = async () => {
    setDetailedVoiceState('wake_detected');
    setTranscript('');
    setAssistantResponse('');
    setVoiceError(null);

    // Speak fast greeting "Haan, bolo." with microphone gated
    speakText('Haan, bolo.', () => {
      // Once greeting completes, automatically transition to manual listen
      triggerManualListen();
    });
  };

  // Submit valid user utterance to Agent API and play TTS response
  const handleUserUtterance = async (userText: string) => {
    if (!userText || isSpeakingRef.current) return;
    const cleanText = userText.trim();
    if (!cleanText) return;

    console.log(`[VOICE] life ai agent api request: "${cleanText}"`);
    setVoiceState('thinking');
    setDetailedVoiceState('processing');

    try {
      const res = await api.sendMessage({
        content: cleanText,
        conversation_id: activeConversationId || undefined,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        voice_mode: true
      });

      console.log(`[VOICE] response received: "${(res.response || '').substring(0, 60)}..."`);
      setActiveConversationId(res.conversation_id);
      setAssistantResponse(res.response);
      setVoiceError(null);

      // Play synthesized audio response (with mic gated)
      if (res.audio_url) {
        playAudioResponse(res.audio_url, res.response);
      } else {
        speakText(res.response, () => {
          finishSpeakingAndReturnToIdle();
        });
      }
    } catch (err: any) {
      console.error('[VOICE ERROR] Agent API request failed:', err);
      const errMsg = err?.message || 'Server communication failed';
      setVoiceError(`Life AI Backend error: ${errMsg}`);
      setIsBackendOnline(false);

      const voiceReply = !navigator.onLine
        ? 'Internet connection nahi hai. Kripya apna network check karein.'
        : 'Kshama kijiye, mujhe response process karne mein dikkat aayi.';

      setAssistantResponse(voiceReply);
      speakText(voiceReply, () => {
        finishSpeakingAndReturnToIdle();
      });
    }
  };

  // Play audio response from URL (backend Edge-TTS or PyTTSx3)
  const playAudioResponse = (url: string, fallbackText: string = '') => {
    gateMicrophone(true);
    setVoiceState('speaking');
    setDetailedVoiceState('tts');
    isSpeakingRef.current = true;
    console.log('[VOICE] tts started (audio stream playback)');

    if (outputAudioPlayerRef.current) {
      outputAudioPlayerRef.current.pause();
    }

    const host = getServerHostUrl();
    const resolvedUrl = url.startsWith('http') ? url : `${host}${url.startsWith('/') ? '' : '/'}${url}`;
    const audio = new Audio(resolvedUrl);
    audio.crossOrigin = 'anonymous';
    outputAudioPlayerRef.current = audio;

    const onFinish = () => {
      console.log('[VOICE] tts ended');
      stopOutputAudioAnalysis();
      finishSpeakingAndReturnToIdle();
    };

    audio.onended = onFinish;
    audio.onerror = () => {
      console.warn('[VOICE] Audio playback failed, falling back to browser speech synthesis.');
      stopOutputAudioAnalysis();
      if (fallbackText) {
        speakText(fallbackText, () => finishSpeakingAndReturnToIdle());
      } else {
        onFinish();
      }
    };

    // Connect audio element to AudioContext Analyser for synchronized avatar lip-sync
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        if (!outputAudioCtxRef.current || outputAudioCtxRef.current.state === 'closed') {
          outputAudioCtxRef.current = new AudioCtx();
        }
        const ctx = outputAudioCtxRef.current;
        if (ctx.state === 'suspended') {
          ctx.resume();
        }

        const source = ctx.createMediaElementSource(audio);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);
        analyser.connect(ctx.destination);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const sampleAudio = () => {
          if (!isSpeakingRef.current) {
            stopOutputAudioAnalysis();
            return;
          }
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          const energy = Math.min(1.0, avg / 100);
          setAudioEnergy(energy);
          setIsAudioSpeaking(avg > 10);
          outputAnimFrameRef.current = requestAnimationFrame(sampleAudio);
        };
        outputAnimFrameRef.current = requestAnimationFrame(sampleAudio);
      } else {
        startCadenceFallback();
      }
    } catch {
      startCadenceFallback();
    }

    audio.play().catch(() => {
      startCadenceFallback();
      if (fallbackText) {
        speakText(fallbackText, () => finishSpeakingAndReturnToIdle());
      } else {
        onFinish();
      }
    });
  };

  // Browser SpeechSynthesis fallback
  const speakText = (text: string, onCompleted?: () => void) => {
    if (!window.speechSynthesis) {
      stopOutputAudioAnalysis();
      if (onCompleted) onCompleted();
      return;
    }

    gateMicrophone(true);
    window.speechSynthesis.cancel();
    setVoiceState('speaking');
    setDetailedVoiceState('tts');
    isSpeakingRef.current = true;
    console.log('[VOICE] tts started (browser SpeechSynthesis)');

    const utterance = new SpeechSynthesisUtterance(text);
    (window as unknown as IWindow)._currentUtterance = utterance; // Prevent Chrome GC bug

    const voices = window.speechSynthesis.getVoices();
    const indianFemaleVoice = voices.find(v =>
      (v.lang.toLowerCase().includes('in') || v.name.toLowerCase().includes('india') || v.name.toLowerCase().includes('hindi')) &&
      (v.name.toLowerCase().includes('swara') ||
        v.name.toLowerCase().includes('neerja') ||
        v.name.toLowerCase().includes('ananya') ||
        v.name.toLowerCase().includes('heera') ||
        v.name.toLowerCase().includes('kalpana') ||
        (v as any).gender === 'female')
    ) || voices.find(v =>
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
      console.log('[VOICE] tts ended');
      stopOutputAudioAnalysis();
      (window as unknown as IWindow)._currentUtterance = null;
      if (onCompleted) {
        onCompleted();
      } else {
        finishSpeakingAndReturnToIdle();
      }
    };

    utterance.onstart = () => {
      console.log('[VOICE] avatar mouth sync active');
      startCadenceFallback();
    };

    utterance.onboundary = () => {
      setIsAudioSpeaking(true);
      setAudioEnergy(0.8);
      setTimeout(() => {
        if (isSpeakingRef.current) {
          setIsAudioSpeaking(false);
          setAudioEnergy(0.1);
        }
      }, 100);
    };

    utterance.onend = onFinish;
    utterance.onerror = onFinish;

    // Safety timeout: In case SpeechSynthesis onend drops in Chrome
    const estimatedDuration = Math.max(3000, text.length * 85);
    ttsSafetyTimeoutRef.current = setTimeout(() => {
      if (isSpeakingRef.current) {
        console.warn('[VOICE] SpeechSynthesis safety timeout triggered.');
        onFinish();
      }
    }, estimatedDuration);

    window.speechSynthesis.speak(utterance);
  };

  // Microphone Gating: Temporarily mute/disable mic input while TTS is playing to prevent audio feedback loop
  const gateMicrophone = (gate: boolean) => {
    isMicGatedRef.current = gate;
    if (gate) {
      console.log('[VOICE] microphone gated during TTS output (preventing feedback loop)');
      stopRecognitionGracefully();
      releaseActiveMediaStream();
    } else {
      console.log('[VOICE] microphone un-gated');
    }
  };

  // Return to idle state after speaking
  const finishSpeakingAndReturnToIdle = () => {
    isSpeakingRef.current = false;
    gateMicrophone(false);
    setVoiceState('idle');
    setDetailedVoiceState(isWakeWordEnabled ? 'wake_listening' : 'idle');

    // Resume wake listening if enabled
    if (isWakeWordEnabled && !isNative) {
      setTimeout(() => {
        startWakeWordListener();
      }, 500);
    }
  };

  // Full stop: Stop all voice actions, mic, TTS, and reset
  const stopVoice = () => {
    console.log('[VOICE] stopVoice called: terminating all speech and audio');
    isSpeakingRef.current = false;
    isListeningRef.current = false;
    gateMicrophone(false);
    stopWakeWordListener();

    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (speechPauseTimerRef.current) clearTimeout(speechPauseTimerRef.current);
    if (outputAudioPlayerRef.current) outputAudioPlayerRef.current.pause();
    if (window.speechSynthesis) window.speechSynthesis.cancel();

    stopOutputAudioAnalysis();
    stopRecognitionGracefully();
    releaseActiveMediaStream();

    setVoiceState('idle');
    setDetailedVoiceState(isHandsFreeMode ? 'wake_listening' : 'stopped');
  };

  // Toggles
  const toggleWakeWord = () => {
    setIsWakeWordEnabled(prev => !prev);
  };

  const toggleHandsFreeMode = async () => {
    if (isHandsFreeMode) {
      await handsFreeService.stop();
      setIsHandsFreeMode(false);
      setVoiceState('idle');
      setDetailedVoiceState('stopped');
    } else {
      try {
        await handsFreeService.start();
        setIsHandsFreeMode(true);
        setMicPermissionError(false);
        setDetailedVoiceState('wake_listening');
      } catch (err: any) {
        console.error('Hands-Free mode activation error:', err);
        setMicPermissionError(true);
      }
    }
  };

  const updateWakeWord = (word: string) => {
    handsFreeService.setWakeWord(word);
    setWakeWordState(word);
    if (isHandsFreeMode && isNative) {
      handsFreeService.start();
    }
  };

  const updateVoiceResponse = (enabled: boolean) => {
    handsFreeService.setVoiceResponseEnabled(enabled);
    setVoiceResponseState(enabled);
    if (isHandsFreeMode && isNative) {
      handsFreeService.start();
    }
  };

  // Diagnostic Test Helpers
  const testMicrophoneInput = async (seconds: number = 3): Promise<Blob | null> => {
    console.log(`[VOICE DIAGNOSTICS] Testing microphone for ${seconds}s...`);
    const stream = await startLiveMicrophoneStream();
    const chunks: Blob[] = [];
    const rec = new MediaRecorder(stream);
    rec.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
    rec.start();

    await new Promise(r => setTimeout(r, seconds * 1000));
    rec.stop();
    await new Promise(r => { rec.onstop = () => r(null); });
    releaseActiveMediaStream();

    const blob = new Blob(chunks, { type: 'audio/webm' });
    console.log(`[VOICE DIAGNOSTICS] Test recorded blob size: ${blob.size} bytes`);
    return blob;
  };

  const testBackendTranscription = async (audioBlob: Blob): Promise<string> => {
    console.log('[VOICE DIAGNOSTICS] Testing backend Gemini STT endpoint...');
    const res = await api.transcribeAudio(audioBlob);
    console.log(`[VOICE DIAGNOSTICS] Backend transcription result: "${res.transcript}"`);
    return res.transcript;
  };

  const diagnostics: VoiceDiagnosticsState = {
    micAvailable: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
    permissionGranted: micPermissionGranted,
    permissionDenied: micPermissionError,
    streamActive: streamActive,
    sampleRate: audioSampleRate,
    channels: audioChannels,
    inputVolume: inputVolume,
    sttEngine: sttEngine,
    sttSupported: !!((window as unknown as IWindow).SpeechRecognition || (window as unknown as IWindow).webkitSpeechRecognition),
    wakeWordListening: isWakeWordEnabled && detailedVoiceState === 'wake_listening',
    backendConnected: isBackendOnline,
    ttsReady: !!(window.speechSynthesis || isNative),
    lastError: voiceError
  };

  return (
    <VoiceContext.Provider
      value={{
        voiceState,
        detailedVoiceState,
        transcript,
        assistantResponse,
        voiceError,
        isWakeWordEnabled,
        isHandsFreeMode,
        micPermissionError,
        micPermissionGranted,
        activeConversationId,
        wakeWord,
        voiceResponseEnabled,
        isNativePlatform: isNative,
        isBatteryOptimizedExempt,
        isAudioSpeaking,
        audioEnergy,
        inputVolume,
        sttEngine,
        isBackendOnline,
        isDiagnosticsOpen,
        setIsDiagnosticsOpen,
        diagnostics,
        toggleWakeWord,
        toggleHandsFreeMode,
        updateWakeWord,
        updateVoiceResponse,
        triggerManualListen,
        stopVoice,
        playAudioResponse,
        requestMicPermission,
        checkBatteryOptimization,
        requestBatteryOptimizationExemption,
        testMicrophoneInput,
        testBackendTranscription
      }}
    >
      {children}
    </VoiceContext.Provider>
  );
};

export const useVoice = () => {
  const context = useContext(VoiceContext);
  if (!context) {
    throw new Error('useVoice must be used within a VoiceProvider');
  }
  return context;
};