import React, { createContext, useContext, useState, useEffect } from 'react';
import { VoiceState, DetailedVoiceState } from '../types';
import { voiceEngine, VoiceEngineSnapshot } from '../services/voiceEngine';
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
  voiceEngineDriver: 'AndroidVoiceEngine' | 'WebVoiceEngine';
  language: string;
}

interface VoiceContextType {
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
  isDiagnosticsOpen: boolean;
  setIsDiagnosticsOpen: (open: boolean) => void;
  diagnostics: VoiceDiagnosticsState;
  toggleVoiceMode: () => void;
  toggleWakeWord: () => void;
  toggleHandsFreeMode: () => Promise<void>;
  updateWakeWord: (word: string) => void;
  updateVoiceResponse: (enabled: boolean) => void;
  triggerManualListen: () => Promise<void>;
  stopVoice: () => void;
  playAudioResponse: (url: string, fallbackText?: string) => void;
  requestMicPermission: () => Promise<boolean>;
  openAppSettings: () => Promise<void>;
  checkBatteryOptimization: () => Promise<boolean>;
  requestBatteryOptimizationExemption: () => Promise<void>;
  testMicrophoneInput: (seconds?: number) => Promise<Blob | null>;
  testBackendTranscription: (audioBlob: Blob) => Promise<string>;
  isLocalTesting: boolean;
  startLocalVoiceTest: (callback: (transcript: string, isFinal: boolean) => void) => Promise<void>;
  stopLocalVoiceTest: () => void;
}

const VoiceContext = createContext<VoiceContextType | undefined>(undefined);

export const VoiceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [snapshot, setSnapshot] = useState<VoiceEngineSnapshot>(() => voiceEngine.getSnapshot());
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState<boolean>(false);

  useEffect(() => {
    // Initialize VoiceEngine once on app mount
    voiceEngine.init();

    // Subscribe to VoiceEngine updates
    const unsubscribe = voiceEngine.subscribe((newSnap) => {
      setSnapshot(newSnap);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const toggleVoiceMode = () => {
    voiceEngine.setVoiceModeEnabled(!snapshot.isVoiceModeEnabled);
  };

  const toggleWakeWord = () => {
    voiceEngine.setWakeWordEnabled(!snapshot.isWakeWordEnabled);
  };

  const toggleHandsFreeMode = async () => {
    if (snapshot.isHandsFreeMode) {
      await handsFreeService.stop();
      voiceEngine.setHandsFreeMode(false);
    } else {
      try {
        await handsFreeService.start();
        voiceEngine.setHandsFreeMode(true);
      } catch (err) {
        console.error('Hands-Free mode activation error:', err);
      }
    }
  };

  const updateWakeWord = (word: string) => {
    voiceEngine.setWakeWord(word);
  };

  const updateVoiceResponse = (enabled: boolean) => {
    voiceEngine.setVoiceResponseEnabled(enabled);
  };

  const triggerManualListen = async () => {
    await voiceEngine.triggerManualListen();
  };

  const stopVoice = () => {
    voiceEngine.stopVoice();
  };

  const playAudioResponse = (url: string, fallbackText?: string) => {
    voiceEngine.playAudioResponse(url, fallbackText);
  };

  const requestMicPermission = async (): Promise<boolean> => {
    return await voiceEngine.requestMicPermission();
  };

  const openAppSettings = async (): Promise<void> => {
    await voiceEngine.openNativeAppSettings();
  };

  const checkBatteryOptimization = async (): Promise<boolean> => {
    if (snapshot.isNativePlatform) {
      return await handsFreeService.checkBatteryOptimization();
    }
    return true;
  };

  const requestBatteryOptimizationExemption = async (): Promise<void> => {
    if (snapshot.isNativePlatform) {
      await handsFreeService.requestIgnoreBatteryOptimization();
    }
  };

  const testMicrophoneInput = async (seconds?: number): Promise<Blob | null> => {
    return await voiceEngine.testMicrophoneInput(seconds || 3);
  };

  const testBackendTranscription = async (audioBlob: Blob): Promise<string> => {
    return await voiceEngine.testBackendTranscription(audioBlob);
  };

  const startLocalVoiceTest = async (callback: (transcript: string, isFinal: boolean) => void) => {
    await voiceEngine.startLocalVoiceTest(callback);
  };

  const stopLocalVoiceTest = () => {
    voiceEngine.stopLocalVoiceTest();
  };

  const diagnostics: VoiceDiagnosticsState = {
    micAvailable: snapshot.isNativePlatform || !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
    permissionGranted: snapshot.micPermissionGranted,
    permissionDenied: snapshot.micPermissionError,
    streamActive: snapshot.streamActive,
    sampleRate: snapshot.audioSampleRate,
    channels: snapshot.audioChannels,
    inputVolume: snapshot.inputVolume,
    sttEngine: snapshot.sttEngine,
    sttSupported: !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) || snapshot.isNativePlatform,
    wakeWordListening: snapshot.isVoiceModeEnabled && (snapshot.detailedVoiceState === 'wake_listening' || (snapshot.isNativePlatform && snapshot.isHandsFreeMode)),
    backendConnected: snapshot.isBackendOnline,
    ttsReady: !!(window.speechSynthesis || snapshot.isNativePlatform),
    lastError: snapshot.voiceError,
    voiceEngineDriver: snapshot.voiceEngineDriver || (snapshot.isNativePlatform ? 'AndroidVoiceEngine' : 'WebVoiceEngine'),
    language: 'en-IN'
  };

  return (
    <VoiceContext.Provider
      value={{
        voiceState: snapshot.voiceState,
        detailedVoiceState: snapshot.detailedVoiceState,
        transcript: snapshot.transcript,
        assistantResponse: snapshot.assistantResponse,
        voiceError: snapshot.voiceError,
        isVoiceModeEnabled: snapshot.isVoiceModeEnabled,
        isConversationActive: snapshot.isConversationActive,
        isWakeWordEnabled: snapshot.isWakeWordEnabled,
        isHandsFreeMode: snapshot.isHandsFreeMode,
        micPermissionError: snapshot.micPermissionError,
        micPermissionGranted: snapshot.micPermissionGranted,
        activeConversationId: snapshot.activeConversationId,
        wakeWord: snapshot.wakeWord,
        voiceResponseEnabled: snapshot.voiceResponseEnabled,
        isNativePlatform: snapshot.isNativePlatform,
        isBatteryOptimizedExempt: snapshot.isBatteryOptimizedExempt,
        isAudioSpeaking: snapshot.isAudioSpeaking,
        audioEnergy: snapshot.audioEnergy,
        inputVolume: snapshot.inputVolume,
        sttEngine: snapshot.sttEngine,
        isBackendOnline: snapshot.isBackendOnline,
        isDiagnosticsOpen,
        setIsDiagnosticsOpen,
        diagnostics,
        toggleVoiceMode,
        toggleWakeWord,
        toggleHandsFreeMode,
        updateWakeWord,
        updateVoiceResponse,
        triggerManualListen,
        stopVoice,
        playAudioResponse,
        requestMicPermission,
        openAppSettings,
        checkBatteryOptimization,
        requestBatteryOptimizationExemption,
        testMicrophoneInput,
        testBackendTranscription,
        isLocalTesting: snapshot.isLocalTesting,
        startLocalVoiceTest,
        stopLocalVoiceTest
      }}
    >
      {children}
    </VoiceContext.Provider>
  );
};

export const useVoice = (): VoiceContextType => {
  const context = useContext(VoiceContext);
  if (!context) {
    const snap = voiceEngine.getSnapshot();
    return {
      ...snap,
      isDiagnosticsOpen: false,
      setIsDiagnosticsOpen: () => {},
      diagnostics: {
        micAvailable: snap.streamActive || snap.micPermissionGranted,
        permissionGranted: snap.micPermissionGranted,
        permissionDenied: snap.micPermissionError,
        streamActive: snap.streamActive,
        sampleRate: snap.audioSampleRate,
        channels: snap.audioChannels,
        inputVolume: snap.inputVolume,
        sttEngine: snap.sttEngine,
        sttSupported: snap.sttEngine !== 'unavailable',
        wakeWordListening: snap.detailedVoiceState === 'wake_listening',
        backendConnected: snap.isBackendOnline,
        ttsReady: true,
        lastError: snap.voiceError,
        voiceEngineDriver: snap.voiceEngineDriver || (snap.isNativePlatform ? 'AndroidVoiceEngine' : 'WebVoiceEngine'),
        language: 'en-IN'
      },
      toggleVoiceMode: () => voiceEngine.setVoiceModeEnabled(!snap.isVoiceModeEnabled),
      toggleWakeWord: () => voiceEngine.setWakeWordEnabled(!snap.isWakeWordEnabled),
      toggleHandsFreeMode: async () => {
        if (snap.isHandsFreeMode) {
          await handsFreeService.stop();
          voiceEngine.setHandsFreeMode(false);
        } else {
          await handsFreeService.start();
          voiceEngine.setHandsFreeMode(true);
        }
      },
      updateWakeWord: (w: string) => voiceEngine.setWakeWord(w),
      updateVoiceResponse: (en: boolean) => voiceEngine.setVoiceResponseEnabled(en),
      triggerManualListen: async () => voiceEngine.triggerManualListen(),
      stopVoice: () => voiceEngine.stopVoice(),
      playAudioResponse: (url: string, fb?: string) => voiceEngine.playAudioResponse(url, fb),
      requestMicPermission: async () => voiceEngine.requestMicPermission(),
      openAppSettings: async () => voiceEngine.openNativeAppSettings(),
      checkBatteryOptimization: async () => handsFreeService.checkBatteryOptimization(),
      requestBatteryOptimizationExemption: async () => { await handsFreeService.requestIgnoreBatteryOptimization(); },
      testMicrophoneInput: async () => null,
      testBackendTranscription: async () => '',
      isLocalTesting: snap.isLocalTesting,
      startLocalVoiceTest: async (cb) => voiceEngine.startLocalVoiceTest(cb),
      stopLocalVoiceTest: () => voiceEngine.stopLocalVoiceTest()
    };
  }
  return context;
};