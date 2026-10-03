import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { VoiceState } from '../types';
import { api, getServerHostUrl } from '../services/api';

interface VoiceContextType {
  voiceState: VoiceState;
  transcript: string;
  assistantResponse: string;
  isWakeWordEnabled: boolean;
  micPermissionError: boolean;
  activeConversationId: string | null;
  toggleWakeWord: () => void;
  triggerManualListen: () => void;
  stopVoice: () => void;
  playAudioResponse: (url: string) => void;
  requestMicPermission: () => Promise<void>;
}

const VoiceContext = createContext<VoiceContextType | undefined>(undefined);

interface IWindow extends Window {
  webkitSpeechRecognition: any;
  SpeechRecognition: any;
}

export const VoiceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState<string>('');
  const [assistantResponse, setAssistantResponse] = useState<string>('');
  const [isWakeWordEnabled, setIsWakeWordEnabled] = useState<boolean>(true);
  const [micPermissionError, setMicPermissionError] = useState<boolean>(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef<boolean>(false);
  const isSpeakingRef = useRef<boolean>(false);
  const isInActiveConversationRef = useRef<boolean>(false);
  const lastSpokenTextRef = useRef<string>('');

  const silenceTimerRef = useRef<any>(null);
  const speechDebounceTimerRef = useRef<any>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Request browser microphone permission explicitly
  const requestMicPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      setMicPermissionError(false);
      startRecognition();
    } catch (err) {
      console.error('Microphone permission denied:', err);
      setMicPermissionError(true);
    }
  };

  const startRecognition = () => {
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

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition =
      (window as unknown as IWindow).SpeechRecognition ||
      (window as unknown as IWindow).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('SpeechRecognition API not available in this browser.');
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

      // 1. Idle State: Wake Word Detection ("Life" / "लाइफ" / "Jeet")
      if (!isInActiveConversationRef.current) {
        if (
          lower.includes('life') ||
          lower.includes('lyf') ||
          lower.includes('लाइफ') ||
          lower.includes('लाइफ़') ||
          lower.includes('jeet') ||
          lower.includes('jeeth') ||
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
      // Ignore normal 'aborted' and 'no-speech' events from browser
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
      // Auto-restart recognition after 150ms unless assistant is currently speaking
      if (isWakeWordEnabled && !isSpeakingRef.current) {
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
  }, [isWakeWordEnabled]);

  const handleWakeWordTriggered = async () => {
    console.log("Wake word 'Life' detected!");
    isInActiveConversationRef.current = true;
    setVoiceState('listening');
    setTranscript('');
    lastSpokenTextRef.current = '';

    try {
      const res = await api.synthesizeSpeech("Haan, bolo.");
      if (res.audio_url) {
        playAudioResponse(res.audio_url, "Haan, bolo.");
      } else {
        speakText("Haan, bolo.");
      }
    } catch (_) {
      speakText("Haan, bolo.");
    }
    resetSilenceTimer();
  };

  const handleUserUtterance = async (userText: string) => {
    if (!userText || isSpeakingRef.current) return;
    const cleanText = userText.trim();
    const cleanLow = cleanText.toLowerCase();
    if (cleanLow === 'life' || cleanLow === 'लाइफ' || cleanLow === 'jeet' || cleanLow === 'जीत') return;

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
    } catch (err) {
      console.error('Failed to get answer:', err);
      speakText('Kshama kijiye, mujhe response process karne mein dikkat aayi.');
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
    audioPlayerRef.current = audio;

    const onFinish = () => {
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
      if (fallbackText) {
        speakText(fallbackText);
      } else {
        onFinish();
      }
    };

    audio.play().catch(() => {
      if (fallbackText) {
        speakText(fallbackText);
      } else {
        onFinish();
      }
    });
  };

  const speakText = (text: string) => {
    if (!window.speechSynthesis) {
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
      isSpeakingRef.current = false;
      setVoiceState('listening');
      setTranscript('');
      lastSpokenTextRef.current = '';
      resetSilenceTimer();
      setTimeout(() => {
        startRecognition();
      }, 200);
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

  const triggerManualListen = () => {
    requestMicPermission();
    isInActiveConversationRef.current = true;
    setVoiceState('listening');
    setTranscript('');
    lastSpokenTextRef.current = '';
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
  };

  const toggleWakeWord = () => {
    setIsWakeWordEnabled(prev => !prev);
  };

  return (
    <VoiceContext.Provider
      value={{
        voiceState,
        transcript,
        assistantResponse,
        isWakeWordEnabled,
        micPermissionError,
        activeConversationId,
        toggleWakeWord,
        triggerManualListen,
        stopVoice,
        playAudioResponse,
        requestMicPermission
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