import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { VoiceState, DetailedVoiceState } from '../types';
import { api, getServerHostUrl } from '../services/api';
import { handsFreeService } from '../services/handsFreeService';

interface VoiceContextType {
  voiceState: VoiceState;
  detailedVoiceState: DetailedVoiceState;
  transcript: string;
  assistantResponse: string;
  isWakeWordEnabled: boolean;
  isHandsFreeMode: boolean;
  micPermissionError: boolean;
  activeConversationId: string | null;
  wakeWord: string;
  voiceResponseEnabled: boolean;
  isNativePlatform: boolean;
  isBatteryOptimizedExempt: boolean;
  isAudioSpeaking: boolean;
  audioEnergy: number;
  toggleWakeWord: () => void;
  toggleHandsFreeMode: () => Promise<void>;
  updateWakeWord: (word: string) => void;
  updateVoiceResponse: (enabled: boolean) => void;
  triggerManualListen: () => void;
  stopVoice: () => void;
  playAudioResponse: (url: string) => void;
  requestMicPermission: () => Promise<void>;
  checkBatteryOptimization: () => Promise<boolean>;
  requestBatteryOptimizationExemption: () => Promise<void>;
}

const VoiceContext = createContext<VoiceContextType | undefined>(undefined);

interface IWindow extends Window {
  webkitSpeechRecognition: any;
  SpeechRecognition: any;
}

export const VoiceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [detailedVoiceState, setDetailedVoiceState] = useState<DetailedVoiceState>('stopped');
  const [transcript, setTranscript] = useState<string>('');
  const [assistantResponse, setAssistantResponse] = useState<string>('');
  const [isWakeWordEnabled, setIsWakeWordEnabled] = useState<boolean>(true);
  const [isHandsFreeMode, setIsHandsFreeMode] = useState<boolean>(handsFreeService.isEnabledLocally());
  const [wakeWord, setWakeWordState] = useState<string>(handsFreeService.getWakeWord());
  const [voiceResponseEnabled, setVoiceResponseState] = useState<boolean>(handsFreeService.isVoiceResponseEnabled());
  const [micPermissionError, setMicPermissionError] = useState<boolean>(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isBatteryOptimizedExempt, setIsBatteryOptimizedExempt] = useState<boolean>(true);
  const [isAudioSpeaking, setIsAudioSpeaking] = useState<boolean>(false);
  const [audioEnergy, setAudioEnergy] = useState<number>(0);

  const isNative = handsFreeService.isNativeAvailable();

  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef<boolean>(false);
  const isSpeakingRef = useRef<boolean>(false);
  const isInActiveConversationRef = useRef<boolean>(false);
  const lastSpokenTextRef = useRef<string>('');

  const silenceTimerRef = useRef<any>(null);
  const speechDebounceTimerRef = useRef<any>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const cadenceIntervalRef = useRef<any>(null);

  const stopAudioAnalysis = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (cadenceIntervalRef.current) {
      clearInterval(cadenceIntervalRef.current);
      cadenceIntervalRef.current = null;
    }
    setIsAudioSpeaking(false);
    setAudioEnergy(0);
  };

  const startCadenceFallback = () => {
    stopAudioAnalysis();
    cadenceIntervalRef.current = setInterval(() => {
      if (isSpeakingRef.current) {
        setIsAudioSpeaking(prev => !prev);
        setAudioEnergy(Math.random() * 0.5 + 0.4);
      } else {
        stopAudioAnalysis();
      }
    }, 180);
  };

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
        });

        subResponse = await handsFreeService.addListener('assistantResponse', (data: { response: string; conversationId?: string }) => {
          setAssistantResponse(data.response);
          if (data.conversationId) {
            setActiveConversationId(data.conversationId);
          }
        });

        subError = await handsFreeService.addListener('voiceError', (data: { error: string }) => {
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
  }, [isNative]);

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

  // Request microphone permission explicitly
  const requestMicPermission = async () => {
    try {
      if (isNative) {
        await handsFreeService.start();
        setIsHandsFreeMode(true);
        setMicPermissionError(false);
      } else {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop());
        setMicPermissionError(false);
        startRecognition();
      }
    } catch (err) {
      console.error('Microphone permission denied:', err);
      setMicPermissionError(true);
    }
  };

  const startRecognition = () => {
    // If running on native Android, native HandsFreeVoiceService manages audio capture exclusively
    if (isNative) return;
    if (!recognitionRef.current || isListeningRef.current || isSpeakingRef.current) return;
    try {
      recognitionRef.current.start();
      isListeningRef.current = true;
      setMicPermissionError(false);
    } catch (e: any) {
      if (e.name !== 'InvalidStateError') {
        console.warn('Recognition start warning:', e);
      }
    }
  };

  const stopRecognitionGracefully = () => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
    } catch (_) {}
    isListeningRef.current = false;
  };

  // Initialize Web Speech Recognition for Web / Browser Mode ONLY
  useEffect(() => {
    if (isNative) {
      // In native Android APK, HandsFreeVoiceService handles ALL mic input and speech recognition.
      // Running Web Speech Recognition in WebView causes AudioRecord collisions (ERROR_CLIENT / ERROR_RECOGNIZER_BUSY).
      stopRecognitionGracefully();
      return;
    }

    const SpeechRecognition =
      (window as unknown as IWindow).SpeechRecognition ||
      (window as unknown as IWindow).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('SpeechRecognition API not available in this browser environment.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-IN'; // Indian accents, English words & Hinglish phrases cleanly

    recognition.onstart = () => {
      isListeningRef.current = true;
      setMicPermissionError(false);
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

      const heardText = (finalStr || interim).trim();
      if (!heardText) return;

      setTranscript(heardText);
      lastSpokenTextRef.current = heardText;

      const lower = heardText.toLowerCase();

      // 1. Idle State: Wake Word Detection ("Hey Life" / "Life" / "Jeet")
      if (!isInActiveConversationRef.current) {
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
          handleWakeWordTriggered();
        }
      } else {
        // 2. Active Conversation: Debounce speech to auto-submit when user pauses
        resetSilenceTimer();

        if (speechDebounceTimerRef.current) {
          clearTimeout(speechDebounceTimerRef.current);
        }

        // When user pauses speaking for 1.2 seconds, automatically submit!
        speechDebounceTimerRef.current = setTimeout(() => {
          const textToSubmit = lastSpokenTextRef.current;
          if (textToSubmit && textToSubmit.length > 1 && !isSpeakingRef.current) {
            handleUserUtterance(textToSubmit);
          }
        }, 1200);
      }
    };

    recognition.onerror = (e: any) => {
      if (e.error === 'aborted' || e.error === 'no-speech') {
        isListeningRef.current = false;
        return;
      }

      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setMicPermissionError(true);
      } else {
        console.warn('Speech recognition status:', e.error);
      }
      isListeningRef.current = false;
    };

    recognition.onend = () => {
      isListeningRef.current = false;
      // Auto-restart recognition after 150ms unless assistant is currently speaking or native mode took over
      if (isWakeWordEnabled && !isSpeakingRef.current && !(isNative && isHandsFreeMode)) {
        setTimeout(() => {
          startRecognition();
        }, 150);
      }
    };

    recognitionRef.current = recognition;
    startRecognition();

    return () => {
      stopRecognitionGracefully();
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (speechDebounceTimerRef.current) clearTimeout(speechDebounceTimerRef.current);
    };
  }, [isWakeWordEnabled, isHandsFreeMode, isNative, wakeWord]);

  const handleWakeWordTriggered = async () => {
    console.log(`Wake word '${wakeWord}' detected!`);
    isInActiveConversationRef.current = true;
    setVoiceState('listening');
    setDetailedVoiceState('user_listening');
    setTranscript('');
    lastSpokenTextRef.current = '';

    // Fast local greeting with 0ms network latency
    speakText("Haan, bolo.");
    resetSilenceTimer();
  };

  const handleUserUtterance = async (userText: string) => {
    if (!userText || isSpeakingRef.current) return;
    const cleanText = userText.trim();
    const cleanLow = cleanText.toLowerCase();
    if (cleanLow === 'hey life' || cleanLow === 'life' || cleanLow === 'लाइफ' || cleanLow === 'jeet' || cleanLow === 'जीत') return;

    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (speechDebounceTimerRef.current) clearTimeout(speechDebounceTimerRef.current);

    setVoiceState('thinking');

    try {
      const res = await api.sendMessage({
        content: cleanText,
        conversation_id: activeConversationId || undefined,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        voice_mode: true
      });

      setActiveConversationId(res.conversation_id);
      setAssistantResponse(res.response);

      if (res.audio_url) {
        playAudioResponse(res.audio_url, res.response);
      } else {
        speakText(res.response);
      }
    } catch (err: any) {
      console.error('Failed to get answer:', err);
      let errMsg = 'Kshama kijiye, mujhe response process karne mein dikkat aayi.';
      if (!navigator.onLine) {
        errMsg = 'Internet connection nahi hai.';
      } else if (err?.message?.includes('timeout')) {
        errMsg = 'Response lene mein thoda problem aa raha hai.';
      }
      speakText(errMsg);
      setVoiceState('idle');
      isInActiveConversationRef.current = false;
    }
  };

  const playAudioResponse = (url: string, fallbackText: string = '') => {
    setVoiceState('speaking');
    isSpeakingRef.current = true;
    stopRecognitionGracefully();

    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
    }
    const host = getServerHostUrl();
    const resolvedUrl = url.startsWith('http') ? url : `${host}${url.startsWith('/') ? '' : '/'}${url}`;
    const audio = new Audio(resolvedUrl);
    audio.crossOrigin = 'anonymous';
    audioPlayerRef.current = audio;

    const onFinish = () => {
      stopAudioAnalysis();
      isSpeakingRef.current = false;
      setVoiceState('listening');
      setTranscript('');
      lastSpokenTextRef.current = '';
      resetSilenceTimer();
      setTimeout(() => {
        startRecognition();
      }, 200);
    };

    audio.onended = onFinish;
    audio.onerror = () => {
      stopAudioAnalysis();
      if (fallbackText) {
        speakText(fallbackText);
      } else {
        onFinish();
      }
    };

    // Attach audio analyzer for synchronized lip-sync
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioCtx();
        }
        const ctx = audioContextRef.current;
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
            stopAudioAnalysis();
            return;
          }
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          const energy = Math.min(1, avg / 110);
          setAudioEnergy(energy);
          setIsAudioSpeaking(avg > 8);
          animationFrameRef.current = requestAnimationFrame(sampleAudio);
        };
        animationFrameRef.current = requestAnimationFrame(sampleAudio);
      } else {
        startCadenceFallback();
      }
    } catch {
      startCadenceFallback();
    }

    audio.play().catch(() => {
      stopAudioAnalysis();
      if (fallbackText) {
        speakText(fallbackText);
      } else {
        onFinish();
      }
    });
  };

  const speakText = (text: string) => {
    if (!window.speechSynthesis) {
      stopAudioAnalysis();
      setVoiceState('listening');
      resetSilenceTimer();
      return;
    }
    window.speechSynthesis.cancel();
    setVoiceState('speaking');
    isSpeakingRef.current = true;
    stopRecognitionGracefully();

    const utterance = new SpeechSynthesisUtterance(text);
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
      stopAudioAnalysis();
      isSpeakingRef.current = false;
      setVoiceState('listening');
      setTranscript('');
      lastSpokenTextRef.current = '';
      resetSilenceTimer();
      setTimeout(() => {
        startRecognition();
      }, 200);
    };

    utterance.onstart = () => {
      startCadenceFallback();
    };

    utterance.onboundary = () => {
      setIsAudioSpeaking(true);
      setAudioEnergy(0.85);
      setTimeout(() => {
        if (isSpeakingRef.current) {
          setIsAudioSpeaking(false);
          setAudioEnergy(0.1);
        }
      }, 120);
    };

    utterance.onend = onFinish;
    utterance.onerror = onFinish;
    window.speechSynthesis.speak(utterance);
  };

  const resetSilenceTimer = () => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(() => {
      console.log('Silence timeout reached. Returning to idle state.');
      isInActiveConversationRef.current = false;
      setVoiceState('idle');
      setTranscript('');
      lastSpokenTextRef.current = '';
    }, 8000);
  };

  const triggerManualListen = async () => {
    isInActiveConversationRef.current = true;
    setVoiceState('listening');
    setTranscript('');
    lastSpokenTextRef.current = '';

    if (isNative) {
      try {
        await handsFreeService.start();
        setIsHandsFreeMode(true);
        setMicPermissionError(false);
      } catch (err: any) {
        console.error('Failed to trigger native listen:', err);
        setMicPermissionError(true);
      }
      return;
    }

    requestMicPermission();
    setDetailedVoiceState('user_listening');
    resetSilenceTimer();
    startRecognition();
  };

  const stopVoice = () => {
    isInActiveConversationRef.current = false;
    isSpeakingRef.current = false;
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (speechDebounceTimerRef.current) clearTimeout(speechDebounceTimerRef.current);
    if (audioPlayerRef.current) audioPlayerRef.current.pause();
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    stopRecognitionGracefully();
    setVoiceState('idle');
    setDetailedVoiceState(isHandsFreeMode ? 'wake_listening' : 'stopped');
  };

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
      handsFreeService.start(); // restart service with updated wake word
    }
  };

  const updateVoiceResponse = (enabled: boolean) => {
    handsFreeService.setVoiceResponseEnabled(enabled);
    setVoiceResponseState(enabled);
    if (isHandsFreeMode && isNative) {
      handsFreeService.start();
    }
  };

  return (
    <VoiceContext.Provider
      value={{
        voiceState,
        detailedVoiceState,
        transcript,
        assistantResponse,
        isWakeWordEnabled,
        isHandsFreeMode,
        micPermissionError,
        activeConversationId,
        wakeWord,
        voiceResponseEnabled,
        isNativePlatform: isNative,
        isBatteryOptimizedExempt,
        isAudioSpeaking,
        audioEnergy,
        toggleWakeWord,
        toggleHandsFreeMode,
        updateWakeWord,
        updateVoiceResponse,
        triggerManualListen,
        stopVoice,
        playAudioResponse,
        requestMicPermission,
        checkBatteryOptimization,
        requestBatteryOptimizationExemption
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