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
    testMicrophoneInput,
    testBackendTranscription,
    playAudioResponse
  } = useVoice();

  const [isRecordingTest, setIsRecordingTest] = useState<boolean>(false);
  const [testAudioBlob, setTestAudioBlob] = useState<Blob | null>(null);
  const [testAudioUrl, setTestAudioUrl] = useState<string | null>(null);
  const [testTranscript, setTestTranscript] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [testError, setTestError] = useState<string | null>(null);

  if (!isDiagnosticsOpen) return null;

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
          <div className="p-3 rounded-xl bg-[#141C2B] border border-[#202B3D] flex items-center justify-between">
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

        {/* Interactive Diagnostic Actions */}
        <div className="mt-5 p-4 rounded-2xl bg-black/40 border border-[#202B3D] space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Hardware & Speech Pipeline Tests
          </h3>

          <div className="flex flex-wrap gap-2.5">
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
