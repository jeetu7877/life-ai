import React, { useState, useEffect } from 'react';
import { useVoice } from '../context/VoiceContext';
import { VoiceWaveform } from './VoiceWaveform';
import {
  Mic,
  MicOff,
  Radio,
  Sparkles,
  Volume2,
  Cpu,
  Layers,
  MessageSquare
} from 'lucide-react';
import idleImage from '../assets/companion/companion-idle.jpg';
import speakingImage from '../assets/companion/companion-speaking.jpg';

interface CompanionStageProps {
  onOpenChat?: () => void;
}

export const CompanionStage: React.FC<CompanionStageProps> = ({ onOpenChat }) => {
  const {
    voiceState,
    detailedVoiceState,
    transcript,
    assistantResponse,
    isWakeWordEnabled,
    isHandsFreeMode,
    wakeWord,
    toggleWakeWord,
    toggleHandsFreeMode,
    triggerManualListen
  } = useVoice();

  // Talking mouth animation cycle when speaking
  const [mouthOpen, setMouthOpen] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'companion' | 'orb'>(() => {
    return (localStorage.getItem('life_companion_view_mode') as 'companion' | 'orb') || 'companion';
  });

  const toggleViewMode = (mode: 'companion' | 'orb') => {
    setViewMode(mode);
    localStorage.setItem('life_companion_view_mode', mode);
  };

  useEffect(() => {
    if (voiceState !== 'speaking') {
      setMouthOpen(false);
      return;
    }

    // Realistic speech cadence mouth fluctuation
    const interval = setInterval(() => {
      setMouthOpen((prev) => !prev);
    }, 220);

    return () => clearInterval(interval);
  }, [voiceState]);

  // Determine state aura colors and labels
  const getStateMeta = () => {
    switch (voiceState) {
      case 'listening':
        return {
          glowColor: 'rgba(0, 217, 255, 0.45)',
          borderColor: 'border-[#00D9FF]',
          badgeBg: 'bg-[#00D9FF]/15 text-[#00D9FF] border-[#00D9FF]/40',
          statusText: 'Listening to you...',
          pulseRing: 'ring-[#00D9FF]/40 animate-pulse'
        };
      case 'thinking':
        return {
          glowColor: 'rgba(139, 92, 246, 0.45)',
          borderColor: 'border-[#8B5CF6]',
          badgeBg: 'bg-[#8B5CF6]/15 text-[#8B5CF6] border-[#8B5CF6]/40',
          statusText: 'Thinking & retrieving knowledge...',
          pulseRing: 'ring-[#8B5CF6]/40 animate-pulse'
        };
      case 'speaking':
        return {
          glowColor: 'rgba(236, 72, 153, 0.45)',
          borderColor: 'border-[#EC4899]',
          badgeBg: 'bg-[#EC4899]/15 text-[#EC4899] border-[#EC4899]/40',
          statusText: 'Speaking...',
          pulseRing: 'ring-[#EC4899]/40 animate-ping'
        };
      default:
        return {
          glowColor: isWakeWordEnabled ? 'rgba(34, 197, 94, 0.25)' : 'rgba(148, 163, 184, 0.1)',
          borderColor: isWakeWordEnabled ? 'border-[#22C55E]/40' : 'border-[#202B3D]',
          badgeBg: isWakeWordEnabled
            ? 'bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/30'
            : 'bg-slate-800/50 text-slate-400 border-slate-700/50',
          statusText: isWakeWordEnabled ? `Listening for "${wakeWord}"` : 'Companion in Standby',
          pulseRing: ''
        };
    }
  };

  const meta = getStateMeta();

  return (
    <div className="w-full flex flex-col items-center select-none">
      {/* Top Controls: Mode Switcher & Wake Word Pill */}
      <div className="w-full flex items-center justify-between mb-3 px-1">
        {/* View Mode Toggle: Companion vs Minimalist Orb */}
        <div className="flex items-center gap-1 p-0.5 rounded-xl bg-[#0A0F18] border border-[#202B3D]">
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

        {/* Live Companion Status Badge */}
        <div className={`px-2.5 py-1 rounded-full border text-[10px] font-semibold flex items-center gap-1.5 transition-all shadow-sm ${meta.badgeBg}`}>
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              voiceState === 'listening'
                ? 'bg-[#00D9FF] animate-ping'
                : voiceState === 'thinking'
                ? 'bg-[#8B5CF6] animate-bounce'
                : voiceState === 'speaking'
                ? 'bg-[#EC4899] animate-pulse'
                : isWakeWordEnabled
                ? 'bg-[#22C55E]'
                : 'bg-slate-500'
            }`}
          />
          <span className="truncate max-w-[150px] sm:max-w-none">{meta.statusText}</span>
        </div>
      </div>

      {/* Primary Companion Stage Container */}
      <div className="relative w-full max-w-[340px] sm:max-w-[380px] aspect-square rounded-3xl overflow-hidden bg-black border border-[#202B3D] shadow-[0_10px_35px_rgba(0,0,0,0.8)] flex items-center justify-center group">
        {/* Dynamic State Ambient Glow / Rim Halo */}
        <div
          className="absolute inset-0 pointer-events-none transition-all duration-700 ease-out z-10"
          style={{
            boxShadow: `inset 0 0 60px ${meta.glowColor}, 0 0 40px ${meta.glowColor}`
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
            {/* Idle / Calm Avatar Image (Smooth Fade) */}
            <img
              src={idleImage}
              alt="Life AI Companion"
              className={`absolute inset-0 w-full h-full object-cover object-top transition-all duration-300 transform scale-100 group-hover:scale-[1.02] ${
                mouthOpen && voiceState === 'speaking' ? 'opacity-0' : 'opacity-100'
              }`}
            />

            {/* Speaking / Talking Avatar Image (Smooth Fade during active speech) */}
            <img
              src={speakingImage}
              alt="Life AI Companion Speaking"
              className={`absolute inset-0 w-full h-full object-cover object-top transition-all duration-300 transform scale-100 group-hover:scale-[1.02] ${
                mouthOpen && voiceState === 'speaking' ? 'opacity-100' : 'opacity-0'
              }`}
            />

            {/* Subtle tech scanline overlay on companion */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/80 pointer-events-none" />

            {/* Interactive Pulse Ring when active */}
            {voiceState !== 'idle' && (
              <div
                className={`absolute inset-0 rounded-3xl border-2 pointer-events-none transition-all ${
                  voiceState === 'listening'
                    ? 'border-[#00D9FF]/60 animate-pulse'
                    : voiceState === 'thinking'
                    ? 'border-[#8B5CF6]/60 animate-pulse'
                    : 'border-[#EC4899]/60 animate-pulse'
                }`}
              />
            )}

            {/* Bottom Floating Control Bar on Companion */}
            <div className="absolute bottom-3 inset-x-3 z-20 flex items-center justify-between pointer-events-auto bg-black/60 backdrop-blur-md px-3 py-2 rounded-2xl border border-white/10 shadow-lg">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleWakeWord();
                  }}
                  className={`p-1.5 rounded-xl border transition-all ${
                    isWakeWordEnabled
                      ? 'bg-[#22C55E]/15 border-[#22C55E]/40 text-[#22C55E]'
                      : 'bg-slate-800/60 border-slate-700 text-slate-400'
                  }`}
                  title={isWakeWordEnabled ? 'Wake word active' : 'Wake word muted'}
                >
                  <Radio className="w-3.5 h-3.5" />
                </button>
                <div className="text-left">
                  <span className="text-[11px] font-bold text-white block leading-tight">Life Companion</span>
                  <span className="text-[9px] text-slate-400 block leading-tight">
                    {voiceState === 'speaking' ? 'Speaking...' : voiceState === 'listening' ? 'Listening...' : 'Tap to talk'}
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
                className={`p-2 rounded-xl transition-all shadow-md flex items-center justify-center cursor-pointer ${
                  voiceState === 'listening'
                    ? 'bg-[#00D9FF] text-black shadow-[0_0_15px_rgba(0,217,255,0.6)] animate-pulse'
                    : 'bg-gradient-to-r from-[#00A8FF] to-[#8B5CF6] text-white hover:opacity-90'
                }`}
                title="Speak to Life AI"
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

      {/* Live Audio Waveform Visualizer */}
      <div className="mt-3 w-full max-w-[340px] sm:max-w-[380px]">
        <VoiceWaveform isActive={voiceState === 'listening' || voiceState === 'speaking'} />
      </div>

      {/* Dynamic Subtitle / Speech Dialog Box */}
      {(voiceState !== 'idle' || transcript || assistantResponse) && (
        <div className="w-full max-w-[340px] sm:max-w-[380px] mt-3 p-3.5 rounded-2xl border border-[#202B3D] bg-[#0A0F18]/95 backdrop-blur-xl text-center shadow-xl animate-fadeIn">
          {voiceState === 'listening' && (
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#00D9FF]">You are saying:</span>
              <p className="text-sm text-slate-100 font-medium italic">
                "{transcript || 'Listening... Speak now'}"
              </p>
            </div>
          )}

          {voiceState === 'thinking' && (
            <div className="flex items-center justify-center gap-2 text-[#8B5CF6] text-xs font-semibold py-1">
              <span className="w-2 h-2 rounded-full bg-[#8B5CF6] animate-ping" />
              Thinking & consulting memory vault...
            </div>
          )}

          {voiceState === 'speaking' && (
            <div className="space-y-1">
              <div className="flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-[#EC4899]">
                <Volume2 className="w-3 h-3 animate-pulse" />
                Life Companion:
              </div>
              <p className="text-xs text-slate-200 leading-relaxed font-normal">
                {assistantResponse}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
