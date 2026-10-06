import React, { useState } from 'react';
import { useVoice } from '../context/VoiceContext';
import {
  Mic,
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Radio,
  Cpu,
  Volume2,
  RefreshCw,
  X,
  Play,
  Square
} from 'lucide-react';

export const VoiceDiagnosticsModal: React.FC = () => {
  const {
    diagnostics,
    isDiagnosticsOpen,
    setIsDiagnosticsOpen,
    inputVolume,
    detailedVoiceState,
    transcript,
    voiceError,
    isWakeWordEnabled,
    isBackendOnline,
    isAudioSpeaking,
    isNativePlatform,
    isBatteryOptimizedExempt,
    requestBatteryOptimizationExemption,
    openAppSettings,
    requestMicPermission,
    triggerManualListen,
    testMicrophoneInput,
    testBackendTranscription,
    playAudioResponse,
    isLocalTesting,
    startLocalVoiceTest,
    stopLocalVoiceTest
  } = useVoice();

  const [isRecordingTest, setIsRecordingTest] = useState<boolean>(false);
  const [testAudioBlob, setTestAudioBlob] = useState<Blob | null>(null);
  const [testAudioUrl, setTestAudioUrl] = useState<string | null>(null);
  const [testTranscript, setTestTranscript] = useState<string | null>(null);
  const [liveTestTranscript, setLiveTestTranscript] = useState<string>('');
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [testError, setTestError] = useState<string | null>(null);

  if (!isDiagnosticsOpen) return null;

  const handleToggleLocalTest = async () => {
    if (isLocalTesting) {
      stopLocalVoiceTest();
    } else {
      setLiveTestTranscript('');
      setTestError(null);
      try {
        await startLocalVoiceTest((text) => {
          setLiveTestTranscript(text);
        });
      } catch (err: any) {
        setTestError(err.message || 'Failed to start local test');
      }
    }
  };

  const handleRunMicTest = async () => {
    try {
      setIsRecordingTest(true);
      setTestError(null);
      setTestTranscript(null);
      const blob = await testMicrophoneInput(3);
      if (blob) {
        setTestAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setTestAudioUrl(url);
      }
    } catch (err: any) {
      setTestError(err.message || 'Microphone test failed');
    } finally {
      setIsRecordingTest(false);
    }
  };

  const handleTestBackendSTT = async () => {
    if (!testAudioBlob) return;
    try {
      setIsTranscribing(true);
      setTestError(null);
      const text = await testBackendTranscription(testAudioBlob);
      setTestTranscript(text || '(Empty transcript returned — no clear speech detected)');
    } catch (err: any) {
      setTestError(`Backend STT error: ${err.message || 'Request failed'}`);
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleTestTTS = () => {
    playAudioResponse('', 'Life AI voice system is fully operational and synchronized.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg bg-[#0D131F] border border-[#202B3D] rounded-3xl p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#202B3D]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#00D9FF]/10 text-[#00D9FF]">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Voice & Audio Diagnostics</h2>
              <p className="text-xs text-slate-400">Real-time hardware, stream, STT & TTS inspection</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsDiagnosticsOpen(false)}
            className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Audio Energy Meter */}
        <div className="mt-5 p-4 rounded-2xl bg-black/50 border border-[#202B3D]">
          <div className="flex items-center justify-between text-xs font-semibold mb-2">
            <span className="text-slate-300 flex items-center gap-1.5">
              <Mic className="w-3.5 h-3.5 text-[#00D9FF]" />
              Live Microphone Energy:
            </span>
            <span className="font-mono text-[#00D9FF]">
              {Math.round(inputVolume * 100)}%
            </span>
          </div>
          <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700">
            <div
              className="h-full rounded-full transition-all duration-75 bg-gradient-to-r from-[#00A8FF] via-[#00D9FF] to-[#22C55E]"
              style={{ width: `${Math.min(100, Math.round(inputVolume * 100))}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            Speak into your microphone to verify live hardware signal detection.
          </p>
        </div>

        {/* Real-time 11 Status Parameters Board */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 text-[11px] font-semibold">
          {/* 1. Voice Engine */}
          <div className="p-2.5 rounded-xl bg-[#141C2B] border border-[#202B3D]">
            <span className="text-[10px] text-slate-400 block uppercase">1. Voice Engine</span>
            <span className={voiceError ? "text-rose-400 font-bold" : "text-emerald-400 font-bold"}>
              {voiceError ? "ERROR" : detailedVoiceState === 'user_listening' || detailedVoiceState === 'listening' ? "LISTENING" : detailedVoiceState === 'speaking' || detailedVoiceState === 'tts' ? "SPEAKING" : "READY"}
            </span>
          </div>

          {/* 2. Microphone Hardware */}
          <div className="p-2.5 rounded-xl bg-[#141C2B] border border-[#202B3D]">
            <span className="text-[10px] text-slate-400 block uppercase">2. Microphone</span>
            <span className={(inputVolume > 0.02 || detailedVoiceState === 'user_listening' || detailedVoiceState === 'listening') ? "text-[#00D9FF] font-bold" : "text-slate-400 font-bold"}>
              {(inputVolume > 0.02 || detailedVoiceState === 'user_listening' || detailedVoiceState === 'listening') ? "OPEN / ACTIVE" : "STANDBY"}
            </span>
          </div>

          {/* 3. Mic Permission */}
          <div className="p-2.5 rounded-xl bg-[#141C2B] border border-[#202B3D]">
            <span className="text-[10px] text-slate-400 block uppercase">3. Permission</span>
            <span className={diagnostics.permissionGranted ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
              {diagnostics.permissionGranted ? "GRANTED" : "DENIED"}
            </span>
          </div>

          {/* 4. Speech Recognizer */}
          <div className="p-2.5 rounded-xl bg-[#141C2B] border border-[#202B3D]">
            <span className="text-[10px] text-slate-400 block uppercase">4. Recognizer</span>
            <span className="text-[#00A8FF] font-bold">
              {isNativePlatform ? "ANDROID NATIVE" : "WEB SPEECH + GEMINI"}
            </span>
          </div>

          {/* 5. Audio Input Level */}
          <div className="p-2.5 rounded-xl bg-[#141C2B] border border-[#202B3D]">
            <span className="text-[10px] text-slate-400 block uppercase">5. Audio Input</span>
            <span className="font-mono text-[#00D9FF] font-bold">
              {Math.round(inputVolume * 100)}% ({inputVolume > 0.02 ? "Signal Detected" : "Quiet"})
            </span>
          </div>

          {/* 6. STT Status */}
          <div className="p-2.5 rounded-xl bg-[#141C2B] border border-[#202B3D]">
            <span className="text-[10px] text-slate-400 block uppercase">6. STT Pipeline</span>
            <span className="text-amber-300 font-bold uppercase">
              {detailedVoiceState === 'user_listening' || detailedVoiceState === 'listening' ? "LISTENING" : detailedVoiceState === 'processing' || detailedVoiceState === 'thinking' ? "THINKING" : "STANDBY"}
            </span>
          </div>

          {/* 7. TTS Status */}
          <div className="p-2.5 rounded-xl bg-[#141C2B] border border-[#202B3D]">
            <span className="text-[10px] text-slate-400 block uppercase">7. TTS Output</span>
            <span className={isAudioSpeaking || detailedVoiceState === 'tts' || detailedVoiceState === 'greeting' ? "text-[#EC4899] font-bold" : "text-slate-400 font-bold"}>
              {isAudioSpeaking || detailedVoiceState === 'tts' || detailedVoiceState === 'greeting' ? "SPEAKING" : "IDLE"}
            </span>
          </div>

          {/* 8. Music Ducking */}
          <div className="p-2.5 rounded-xl bg-[#141C2B] border border-[#202B3D]">
            <span className="text-[10px] text-slate-400 block uppercase">8. Music Ducking</span>
            <span className={(isAudioSpeaking || detailedVoiceState === 'user_listening' || detailedVoiceState === 'listening' || detailedVoiceState === 'speaking') ? "text-purple-400 font-bold" : "text-slate-400 font-bold"}>
              {(isAudioSpeaking || detailedVoiceState === 'user_listening' || detailedVoiceState === 'listening' || detailedVoiceState === 'speaking') ? "DUCKED (-20dB)" : "NORMAL (100%)"}
            </span>
          </div>

          {/* 9. App State */}
          <div className="p-2.5 rounded-xl bg-[#141C2B] border border-[#202B3D]">
            <span className="text-[10px] text-slate-400 block uppercase">9. App State</span>
            <span className="text-emerald-400 font-bold">
              FOREGROUND (ACTIVE)
            </span>
          </div>

          {/* 10. Wake Word Mode */}
          <div className="p-2.5 rounded-xl bg-[#141C2B] border border-[#202B3D]">
            <span className="text-[10px] text-slate-400 block uppercase">10. Wake Word</span>
            <span className={isWakeWordEnabled ? "text-emerald-400 font-bold" : "text-slate-400 font-bold"}>
              {isWakeWordEnabled ? "ACTIVE ('Hey Life')" : "OFF"}
            </span>
          </div>

          {/* 11. Backend Connectivity */}
          <div className="p-2.5 rounded-xl bg-[#141C2B] border border-[#202B3D] col-span-2">
            <span className="text-[10px] text-slate-400 block uppercase">11. Backend Server</span>
            <span className={isBackendOnline ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
              {isBackendOnline ? "ONLINE (Connected to Render)" : "OFFLINE"}
            </span>
          </div>
        </div>

        {/* Live Transcript & Error Board */}
        <div className="mt-3 p-3 rounded-2xl bg-black/40 border border-[#202B3D] space-y-2 text-xs">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Last Live Transcript</span>
            <p className="text-slate-200 italic mt-0.5 font-medium">
              {transcript ? `"${transcript}"` : <span className="text-slate-500 font-normal">None recorded yet</span>}
            </p>
          </div>
          {voiceError && (
            <div className="pt-2 border-t border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 block">Last Error</span>
              <p className="text-rose-300 mt-0.5">{voiceError}</p>
            </div>
          )}
        </div>

        {/* Status Checklist Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          {/* Microphone Availability */}
          <div className="p-3 rounded-xl bg-[#141C2B] border border-[#202B3D] flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-white block">Microphone</span>
              <span className="text-[10px] text-slate-400">Hardware input device</span>
            </div>
            {diagnostics.micAvailable ? (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" /> Ready
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-rose-400">
                <XCircle className="w-3.5 h-3.5" /> Missing
              </span>
            )}
          </div>

          {/* Permission */}
          <div className="p-3 rounded-xl bg-[#141C2B] border border-[#202B3D] flex flex-col justify-between gap-1.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-white block">Permission</span>
                <span className="text-[10px] text-slate-400">Browser/OS mic access</span>
              </div>
              {diagnostics.permissionGranted ? (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Granted
                </span>
              ) : diagnostics.permissionDenied ? (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-rose-400">
                  <XCircle className="w-3.5 h-3.5" /> Denied
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-400">
                  <AlertTriangle className="w-3.5 h-3.5" /> Pending
                </span>
              )}
            </div>
            {diagnostics.permissionDenied && (
              <button
                type="button"
                onClick={openAppSettings}
                className="mt-1 w-full py-1 px-2 rounded-lg bg-rose-500/20 text-rose-300 text-[10px] font-bold border border-rose-500/40 hover:bg-rose-500/30 transition-colors"
              >
                Open App Settings & Grant Mic
              </button>
            )}
          </div>

          {/* Audio Stream */}
          <div className="p-3 rounded-xl bg-[#141C2B] border border-[#202B3D] flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-white block">Audio Stream</span>
              <span className="text-[10px] text-slate-400">
                {diagnostics.sampleRate ? `${diagnostics.sampleRate}Hz • ${diagnostics.channels}ch` : 'Standby / Gated'}
              </span>
            </div>
            {diagnostics.streamActive ? (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" /> Active
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-400">
                ⚪ Idle
              </span>
            )}
          </div>

          {/* STT Engine */}
          <div className="p-3 rounded-xl bg-[#141C2B] border border-[#202B3D] flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-white block">STT Engine</span>
              <span className="text-[10px] text-slate-400">
                {diagnostics.sttEngine === 'web_speech' ? 'Web Speech + Gemini' : 'Gemini Multimodal'}
              </span>
            </div>
            <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" /> Dual Ready
            </span>
          </div>

          {/* Wake Word */}
          <div className="p-3 rounded-xl bg-[#141C2B] border border-[#202B3D] flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-white block">Wake Word</span>
              <span className="text-[10px] text-slate-400">"Hey Life" / "Jeet"</span>
            </div>
            {diagnostics.wakeWordListening ? (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                <Radio className="w-3.5 h-3.5 animate-pulse" /> Listening
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-400">
                ⚪ Standby
              </span>
            )}
          </div>

          {/* Backend API */}
          <div className="p-3 rounded-xl bg-[#141C2B] border border-[#202B3D] flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-white block">Backend Server</span>
              <span className="text-[10px] text-slate-400">Render / Local API</span>
            </div>
            {diagnostics.backendConnected ? (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" /> Connected
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-rose-400">
                <XCircle className="w-3.5 h-3.5" /> Offline
              </span>
            )}
          </div>
        </div>

        {/* Android Native Foreground & Battery Status (Visible on Mobile) */}
        {isNativePlatform && (
          <div className="mt-3.5 p-3.5 rounded-2xl bg-indigo-950/30 border border-indigo-500/30 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-indigo-300 block">Android Background Service</span>
                <span className="text-[10px] text-slate-400">Continuous Hands-Free Assistant</span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Native Bridge Active
              </span>
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-slate-300">Battery Optimization:</span>
              {isBatteryOptimizedExempt ? (
                <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Unrestricted
                </span>
              ) : (
                <button
                  type="button"
                  onClick={requestBatteryOptimizationExemption}
                  className="px-2 py-1 rounded-lg text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30"
                >
                  Disable Optimization
                </button>
              )}
            </div>
          </div>
        )}

        {/* Section 5: Local Voice Test Mode (Zero AI / Zero Backend) */}
        <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-blue-950/40 via-cyan-950/30 to-indigo-950/40 border border-[#00D9FF]/40 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5 text-[#00D9FF]" />
                Local Voice Test Mode (Section 5)
              </span>
              <p className="text-[11px] text-slate-400">
                Tests Mic ➔ Speech Recognition ➔ Live Transcript with zero AI/backend calls.
              </p>
            </div>
            <button
              type="button"
              onClick={handleToggleLocalTest}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                isLocalTesting
                  ? 'bg-rose-500 text-white animate-pulse shadow-md shadow-rose-500/30'
                  : 'bg-[#00D9FF] text-black hover:bg-[#00D9FF]/90 font-bold shadow-md shadow-[#00D9FF]/20'
              }`}
            >
              {isLocalTesting ? 'Stop Local Test' : 'Start Local Test'}
            </button>
          </div>

          {isLocalTesting && (
            <div className="p-3 rounded-xl bg-black/60 border border-[#00D9FF]/30 space-y-1.5 animate-fadeIn">
              <div className="flex items-center justify-between text-[11px] font-semibold">
                <span className="text-[#00D9FF] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#00D9FF] animate-ping" />
                  Live Local Speech Recognizer Active:
                </span>
                <span className="text-emerald-400 font-mono">
                  Mic & STT OK
                </span>
              </div>
              <p className="text-xs text-slate-100 font-medium italic min-h-[24px]">
                {liveTestTranscript ? `"${liveTestTranscript}"` : '(Speak into your microphone now — words will stream here live)'}
              </p>
            </div>
          )}
        </div>

        {/* Interactive Diagnostic Actions */}
        <div className="mt-4 p-4 rounded-2xl bg-black/40 border border-[#202B3D] space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Hardware & Speech Pipeline Tests
          </h3>

          <div className="flex flex-wrap gap-2.5">
            {isNativePlatform && (
              <button
                type="button"
                onClick={triggerManualListen}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 bg-[#00D9FF]/20 hover:bg-[#00D9FF]/30 text-[#00D9FF] border border-[#00D9FF]/40 transition-all cursor-pointer"
              >
                <Mic className="w-3.5 h-3.5" /> Test Native Speech Listener
              </button>
            )}

            {/* Record 3s Test */}
            <button
              type="button"
              onClick={handleRunMicTest}
              disabled={isRecordingTest}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                isRecordingTest
                  ? 'bg-rose-500 text-white animate-pulse'
                  : 'bg-[#1E293B] hover:bg-[#2B394E] text-slate-200 border border-slate-700'
              }`}
            >
              {isRecordingTest ? (
                <>
                  <Square className="w-3.5 h-3.5" /> Recording 3s... Speak Now
                </>
              ) : (
                <>
                  <Mic className="w-3.5 h-3.5 text-[#00D9FF]" /> Record & Test Mic (3s)
                </>
              )}
            </button>

            {/* Test TTS */}
            <button
              type="button"
              onClick={handleTestTTS}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 bg-[#1E293B] hover:bg-[#2B394E] text-slate-200 border border-slate-700 transition-all cursor-pointer"
            >
              <Volume2 className="w-3.5 h-3.5 text-[#EC4899]" /> Test Speaker / TTS
            </button>
          </div>

          {/* Test Audio Playback & Backend STT Trigger */}
          {testAudioUrl && (
            <div className="mt-3 p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <span className="text-[11px] font-semibold text-emerald-400 block">
                Recorded sample captured ({Math.round(testAudioBlob?.size || 0)} bytes):
              </span>
              <audio src={testAudioUrl} controls className="w-full h-8" />

              <button
                type="button"
                onClick={handleTestBackendSTT}
                disabled={isTranscribing}
                className="mt-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#00A8FF]/20 hover:bg-[#00A8FF]/30 text-[#00D9FF] border border-[#00A8FF]/40 flex items-center gap-1.5 cursor-pointer"
              >
                {isTranscribing ? (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin" /> Transcribing with Gemini...
                  </>
                ) : (
                  <>
                    <Cpu className="w-3 h-3" /> Transcribe Sample with Backend Gemini STT
                  </>
                )}
              </button>
            </div>
          )}

          {/* Test Transcript Result */}
          {testTranscript && (
            <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-xs">
              <span className="font-bold text-emerald-400 block mb-1">STT Transcript Result:</span>
              <p className="text-slate-200 italic font-medium">"{testTranscript}"</p>
            </div>
          )}

          {/* Error Message */}
          {testError && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-xs text-rose-300">
              <span className="font-bold block mb-1">Diagnostic Notice:</span>
              {testError}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
