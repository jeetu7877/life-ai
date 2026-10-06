import React, { useState } from 'react';
import { useVoice } from '../context/VoiceContext';
import { VoiceWaveform } from './VoiceWaveform';
import { VoiceDiagnosticsModal } from './VoiceDiagnosticsModal';
import {
  Mic,
  Radio,
  Sparkles,
  Volume2,
  Cpu,
  Activity,
  AlertCircle
} from 'lucide-react';
import { LivingAvatar } from './LivingAvatar';

interface CompanionStageProps {
  onOpenChat?: () => void;
}

export const CompanionStage: React.FC<CompanionStageProps> = ({ onOpenChat }) => {
  const {
    voiceState,
    detailedVoiceState,
    transcript,
    assistantResponse,
    voiceError,
    isVoiceModeEnabled,
    isConversationActive,
    isWakeWordEnabled,
    wakeWord,
    isAudioSpeaking,
    audioEnergy,
    inputVolume,
    setIsDiagnosticsOpen,
    toggleWakeWord,
    triggerManualListen
  } = useVoice();

  const [viewMode, setViewMode] = useState<'companion' | 'orb'>(() => {
    return (localStorage.getItem('life_companion_view_mode') as 'companion' | 'orb') || 'companion';
  });

  const toggleViewMode = (mode: 'companion' | 'orb') => {
    setViewMode(mode);
    localStorage.setItem('life_companion_view_mode', mode);
  };

  // Audio-driven mouth state: open strictly when audio sound energy is present; closed on pauses/silence
  const isMouthOpen = voiceState === 'speaking' && isAudioSpeaking;

  // Determine state aura colors and labels (Strictly adhering to real state machine)
  const getStateMeta = () => {
    switch (voiceState) {
      case 'listening':
        return {
          glowColor: 'rgba(0, 217, 255, 0.45)',
          borderColor: 'border-[#00D9FF]',
          badgeBg: 'bg-[#00D9FF]/15 text-[#00D9FF] border-[#00D9FF]/40',
          statusText:
            detailedVoiceState === 'speech_detected'
              ? 'Hearing you...'
              : detailedVoiceState === 'rearming'
              ? 'Getting ready...'
              : isConversationActive
              ? 'Listening... (Conversation mode ON)'
              : 'Listening...',
          pulseRing: 'ring-[#00D9FF]/40 animate-pulse'
        };
      case 'thinking':
        return {
          glowColor: 'rgba(139, 92, 246, 0.45)',
          borderColor: 'border-[#8B5CF6]',
          badgeBg: 'bg-[#8B5CF6]/15 text-[#8B5CF6] border-[#8B5CF6]/40',
          statusText: detailedVoiceState === 'transcribing' ? 'Transcribing...' : 'Thinking...',
          pulseRing: 'ring-[#8B5CF6]/40 animate-pulse'
        };
      case 'speaking':
        return {
          glowColor: 'rgba(236, 72, 153, 0.45)',
          borderColor: 'border-[#EC4899]',
          badgeBg: 'bg-[#EC4899]/15 text-[#EC4899] border-[#EC4899]/40',
          statusText: 'Life is speaking...',
          pulseRing: 'ring-[#EC4899]/40 animate-ping'
        };
      case 'error':
        return {
          glowColor: 'rgba(239, 68, 68, 0.35)',
          borderColor: 'border-rose-500',
          badgeBg: 'bg-rose-500/15 text-rose-400 border-rose-500/40',
          statusText: 'Voice Attention Needed',
          pulseRing: ''
        };
      default:
        return {
          glowColor: isConversationActive
            ? 'rgba(0, 217, 255, 0.35)'
            : isWakeWordEnabled
            ? 'rgba(34, 197, 94, 0.25)'
            : 'rgba(148, 163, 184, 0.1)',
          borderColor: isConversationActive
            ? 'border-[#00D9FF]/50'
            : isWakeWordEnabled
            ? 'border-[#22C55E]/40'
            : 'border-[#202B3D]',
          badgeBg: isConversationActive
            ? 'bg-[#00D9FF]/15 text-[#00D9FF] border-[#00D9FF]/40'
            : isWakeWordEnabled
            ? 'bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/30'
            : 'bg-slate-800/50 text-slate-400 border-slate-700/50',
          statusText: isConversationActive
            ? 'Conversation mode ON'
            : isWakeWordEnabled
            ? `Listening for "${wakeWord}"...`
            : 'Say "Hey Life"',
          pulseRing: ''
        };
    }
  };

  const meta = getStateMeta();

  return (
    <div className="w-full flex flex-col items-center select-none min-w-0 max-w-full">
      {/* Top Controls: Mode Switcher, Diagnostics & Live Status */}
      <div className="w-full flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3 mb-3 px-0.5 min-w-0 max-w-[min(100%,340px)] sm:max-w-[420px] md:max-w-[480px] lg:max-w-[540px] xl:max-w-[580px]">
        {/* Row 1 on mobile: Mode Switcher on Left, Diag on Right */}
        <div className="flex items-center justify-between w-full sm:w-auto gap-2 min-w-0">
          <div className="flex items-center gap-1 p-0.5 rounded-xl bg-[#0A0F18] border border-[#202B3D] shrink-0">
            <button
              type="button"
              onClick={() => toggleViewMode('companion')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'companion'
                  ? 'bg-gradient-to-r from-[#00A8FF] to-[#8B5CF6] text-white shadow-[0_0_12px_rgba(0,217,255,0.3)]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3 h-3" />
              Companion
            </button>
            <button
              type="button"
              onClick={() => toggleViewMode('orb')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'orb'
                  ? 'bg-[#16202E] text-[#00D9FF] border border-[#00D9FF]/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Cpu className="w-3 h-3" />
              Cyber Orb
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsDiagnosticsOpen(true)}
            className="sm:hidden px-2.5 py-1 rounded-xl border border-slate-700 bg-slate-900/80 hover:bg-slate-800 text-[10px] text-slate-300 font-semibold flex items-center gap-1 transition-all cursor-pointer shrink-0"
            title="Open Voice & Audio Diagnostics"
          >
            <Activity className="w-3 h-3 text-[#00D9FF]" />
            Diag
          </button>
        </div>

        {/* Row 2 on mobile: Diag (desktop only) + Live Status Badge */}
        <div className="flex items-center justify-center sm:justify-end gap-1.5 w-full sm:w-auto min-w-0">
          <button
            type="button"
            onClick={() => setIsDiagnosticsOpen(true)}
            className="hidden sm:flex px-2 py-1 rounded-full border border-slate-700 bg-slate-900/80 hover:bg-slate-800 text-[10px] text-slate-300 font-semibold items-center gap-1 transition-all cursor-pointer shrink-0"
            title="Open Voice & Audio Diagnostics"
          >
            <Activity className="w-3 h-3 text-[#00D9FF]" />
            Diag
          </button>

          {/* Live Companion Status Badge (Responsive & Truncatable) */}
          <div className={`px-2.5 py-1 rounded-full border text-[10px] font-semibold flex items-center gap-1.5 transition-all shadow-sm max-w-full min-w-0 ${meta.badgeBg}`}>
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                voiceState === 'listening'
                  ? 'bg-[#00D9FF] animate-ping'
                  : voiceState === 'thinking'
                  ? 'bg-[#8B5CF6] animate-bounce'
                  : voiceState === 'speaking'
                  ? 'bg-[#EC4899] animate-pulse'
                  : voiceState === 'error'
                  ? 'bg-rose-500'
                  : isWakeWordEnabled
                  ? 'bg-[#22C55E]'
                  : 'bg-slate-500'
              }`}
            />
            <span className="truncate max-w-[240px] sm:max-w-none">{meta.statusText}</span>
          </div>
        </div>
      </div>

      {/* Primary Companion Stage Container */}
      <div className="relative w-full max-w-[min(100%,320px)] xs:max-w-[340px] sm:max-w-[420px] md:max-w-[480px] lg:max-w-[540px] xl:max-w-[580px] aspect-square rounded-3xl overflow-hidden bg-black border border-[#202B3D] shadow-[0_15px_45px_rgba(0,0,0,0.85)] flex items-center justify-center group mx-auto">
        {/* Dynamic State Ambient Glow / Rim Halo */}
        <div
          className="absolute inset-0 pointer-events-none transition-all duration-300 ease-out z-10"
          style={{
            boxShadow: voiceState === 'speaking'
              ? `inset 0 0 ${50 + Math.round(audioEnergy * 40)}px ${meta.glowColor}, 0 0 ${35 + Math.round(audioEnergy * 50)}px ${meta.glowColor}`
              : `inset 0 0 60px ${meta.glowColor}, 0 0 40px ${meta.glowColor}`
          }}
        />

        {viewMode === 'companion' ? (
          /* ============================================================== */
          /* PRIMARY VISUAL REFERENCE: VIRTUAL COMPANION (BUST-UP PORTRAIT) */
          /* ============================================================== */
          <div
            className="relative w-full h-full cursor-pointer overflow-hidden flex items-center justify-center bg-black"
            onClick={triggerManualListen}
            title="Tap companion to speak"
          >
            {/* Living, Audio-Synchronized AI Companion Avatar */}
            <LivingAvatar
              voiceState={voiceState}
              detailedVoiceState={detailedVoiceState}
              isConversationActive={isConversationActive}
              isWakeWordEnabled={isWakeWordEnabled}
              inputVolume={inputVolume}
              onClick={triggerManualListen}
            />

            {/* Interactive Pulse Ring when active */}
            {voiceState !== 'idle' && (
              <div
                className={`absolute inset-0 rounded-3xl border-2 pointer-events-none transition-all ${
                  voiceState === 'listening'
                    ? 'border-[#00D9FF]/60 animate-pulse'
                    : voiceState === 'thinking'
                    ? 'border-[#8B5CF6]/60 animate-pulse'
                    : voiceState === 'error'
                    ? 'border-rose-500/60'
                    : 'border-[#EC4899]/60 animate-pulse'
                }`}
              />
            )}

            {/* Bottom Floating Control Bar on Companion */}
            <div className="absolute bottom-2.5 sm:bottom-3 inset-x-2 sm:inset-x-3 z-20 flex items-center justify-between pointer-events-auto bg-black/60 backdrop-blur-md px-2.5 sm:px-3.5 py-2 sm:py-2.5 rounded-2xl border border-white/10 shadow-lg min-w-0">
              <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1 pr-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleWakeWord();
                  }}
                  className={`p-1.5 rounded-xl border transition-all shrink-0 ${
                    isWakeWordEnabled
                      ? 'bg-[#22C55E]/15 border-[#22C55E]/40 text-[#22C55E]'
                      : 'bg-slate-800/60 border-slate-700 text-slate-400'
                  }`}
                  title={isWakeWordEnabled ? 'Wake word active' : 'Wake word muted'}
                >
                  <Radio className="w-3.5 h-3.5" />
                </button>
                <div className="text-left min-w-0 flex-1">
                  <span className="text-[11px] sm:text-[12px] font-bold text-white block leading-tight truncate">Life Companion</span>
                  <span className="text-[9px] sm:text-[10px] text-slate-400 block leading-tight truncate">
                    {detailedVoiceState === 'speech_detected'
                      ? 'Hearing you...'
                      : detailedVoiceState === 'transcribing'
                      ? 'Got it...'
                      : voiceState === 'thinking'
                      ? 'Thinking...'
                      : voiceState === 'speaking'
                      ? (isMouthOpen ? 'Speaking now...' : 'Speaking (pause)...')
                      : detailedVoiceState === 'rearming'
                      ? 'Getting ready...'
                      : voiceState === 'listening'
                      ? 'Listening... Speak now'
                      : detailedVoiceState === 'ready'
                      ? 'Microphone ready'
                      : !isVoiceModeEnabled
                      ? 'Voice disabled'
                      : 'Say "Hey Life"'}
                  </span>
                </div>
              </div>

              {/* Action Button: Mic Trigger */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  triggerManualListen();
                }}
                className={`p-2 sm:p-2.5 rounded-xl transition-all shadow-md flex items-center justify-center cursor-pointer shrink-0 ${
                  isConversationActive
                    ? 'bg-[#00D9FF] text-black shadow-[0_0_15px_rgba(0,217,255,0.6)] animate-pulse'
                    : 'bg-gradient-to-r from-[#00A8FF] to-[#8B5CF6] text-white hover:opacity-90'
                }`}
                title={isConversationActive ? 'Stop conversation mode' : 'Start conversation mode'}
              >
                <Mic className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          /* ============================================================== */
          /* MINIMALIST CYBER ORB VIEW (ALTERNATIVE)                        */
          /* ============================================================== */
          <div
            className="w-full h-full flex flex-col items-center justify-center cursor-pointer p-6"
            onClick={triggerManualListen}
          >
            <div className="relative flex items-center justify-center">
              {/* Orb Pulse Rings */}
              <div
                className={`w-36 h-36 rounded-full transition-all duration-500 flex items-center justify-center shadow-2xl ${
                  voiceState === 'listening'
                    ? 'bg-gradient-to-tr from-[#00A8FF] via-[#00D9FF] to-[#38BDF8] animate-pulse shadow-[0_0_50px_rgba(0,217,255,0.5)]'
                    : voiceState === 'thinking'
                    ? 'bg-gradient-to-tr from-[#6366F1] via-[#8B5CF6] to-[#A855F7] animate-pulse shadow-[0_0_50px_rgba(139,92,246,0.5)]'
                    : voiceState === 'speaking'
                    ? 'bg-gradient-to-tr from-[#EC4899] via-[#F43F5E] to-[#FB7185] animate-pulse shadow-[0_0_50px_rgba(236,72,153,0.5)]'
                    : 'bg-gradient-to-tr from-[#1E293B] to-[#334155] shadow-[0_0_30px_rgba(0,0,0,0.5)]'
                }`}
              >
                <Mic className="w-10 h-10 text-white" />
              </div>
            </div>
            <p className="mt-4 text-xs font-semibold text-slate-300">Tap Orb to Speak</p>
          </div>
        )}
      </div>

      {/* Live Audio Waveform Visualizer (Reacts dynamically to real mic input and speech output) */}
      <div className="mt-2.5 sm:mt-3 w-full max-w-[min(100%,320px)] xs:max-w-[340px] sm:max-w-[420px] md:max-w-[480px] lg:max-w-[540px] xl:max-w-[580px] overflow-hidden">
        <VoiceWaveform
          isActive={voiceState === 'listening' || voiceState === 'speaking'}
          inputVolume={inputVolume}
          audioEnergy={audioEnergy}
        />
      </div>

      {/* Permanent Reserved Speech & Transcript Dialog Box (Zero Layout Shifting) */}
      <div className="w-full max-w-[min(100%,320px)] xs:max-w-[340px] sm:max-w-[420px] md:max-w-[480px] lg:max-w-[540px] xl:max-w-[580px] mt-3 min-h-[100px] sm:min-h-[105px] p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl border border-[#202B3D] bg-[#0A0F18]/95 backdrop-blur-xl text-left shadow-xl flex flex-col justify-center space-y-2 min-w-0 box-border">
        {voiceState !== 'idle' || transcript || assistantResponse || voiceError ? (
          <>
            {/* User Transcript Display */}
            {(transcript || voiceState === 'listening') && (
              <div className="space-y-1 min-w-0">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#00D9FF] flex items-center gap-1.5 shrink-0">
                  <Mic className="w-3 h-3" />
                  You:
                </span>
                <p className="text-xs sm:text-sm text-slate-100 font-medium italic pl-1 break-words [overflow-wrap:anywhere] min-w-0">
                  "{transcript || (voiceState === 'listening' ? 'Listening... Speak now' : '')}"
                </p>
              </div>
            )}

            {/* Thinking / Retrieval Indicator */}
            {voiceState === 'thinking' && (
              <div className="flex items-center gap-2 text-[#8B5CF6] text-xs font-semibold py-1 min-w-0">
                <span className="w-2 h-2 rounded-full bg-[#8B5CF6] animate-ping shrink-0" />
                <span className="truncate">
                  {detailedVoiceState === 'transcribing'
                    ? 'Transcribing audio with Gemini...'
                    : 'Thinking & consulting knowledge vault...'}
                </span>
              </div>
            )}

            {/* Assistant Response Display */}
            {(assistantResponse || voiceState === 'speaking') && (
              <div className="space-y-1.5 pt-1 border-t border-[#202B3D] min-w-0">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-[#EC4899] shrink-0">
                  <Volume2 className="w-3.5 h-3.5 animate-pulse" />
                  Life AI:
                </div>
                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-normal pl-1 break-words [overflow-wrap:anywhere] min-w-0">
                  {assistantResponse || '...'}
                </p>
              </div>
            )}

            {/* Backend / Network Error Display */}
            {voiceError && (
              <div className="p-2 rounded-xl bg-rose-950/40 border border-rose-500/40 flex items-start gap-2 text-rose-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <div>
                  <span className="font-bold block text-rose-300">Backend Notice</span>
                  <span>{voiceError}</span>
                </div>
              </div>
            )}
          </>
        ) : (
          /* Sleek Standby State (Reserves exact height so layout never jumps) */
          <div className="flex items-center gap-3 py-1">
            <span
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                isConversationActive
                  ? 'bg-[#00D9FF] animate-pulse'
                  : isWakeWordEnabled
                  ? 'bg-[#22C55E] animate-pulse'
                  : 'bg-slate-600'
              }`}
            />
            <div className="min-w-0 flex-1">
              <span className="text-xs text-slate-200 font-semibold block truncate">
                {isConversationActive
                  ? 'Conversation mode ON'
                  : isWakeWordEnabled
                  ? `Listening for "${wakeWord}"`
                  : 'Companion in Standby'}
              </span>
              <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                {isConversationActive
                  ? 'Continuous hands-free conversation active. Speak naturally.'
                  : isWakeWordEnabled
                  ? 'Say "Hey Life" anytime to speak hands-free.'
                  : 'Tap microphone or turn on voice activation in Settings.'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Voice Diagnostics Modal */}
      <VoiceDiagnosticsModal />
    </div>
  );
};
