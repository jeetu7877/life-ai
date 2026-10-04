import React from 'react';
import { Mic, MicOff, Volume2, Sparkles, Loader2, Radio, AlertTriangle } from 'lucide-react';
import { VoiceState, DetailedVoiceState } from '../types';

interface WakeWordIndicatorProps {
  state: VoiceState;
  detailedState?: DetailedVoiceState;
  wakeWordEnabled: boolean;
  isHandsFreeMode?: boolean;
  wakeWord?: string;
  onToggleWakeWord: () => void;
  onToggleHandsFree?: () => void;
  onManualTrigger: () => void;
}

export const WakeWordIndicator: React.FC<WakeWordIndicatorProps> = ({
  state,
  detailedState,
  wakeWordEnabled,
  isHandsFreeMode = false,
  wakeWord = 'Hey Life',
  onToggleWakeWord,
  onToggleHandsFree,
  onManualTrigger
}) => {
  // Determine effective status config
  const getStatusConfig = () => {
    // If detailedState is available, use it for precise status
    const effective = detailedState || (
      state === 'speaking' ? 'tts' :
      state === 'thinking' ? 'processing' :
      state === 'listening' ? 'user_listening' :
      isHandsFreeMode || wakeWordEnabled ? 'wake_listening' : 'stopped'
    );

    switch (effective) {
      case 'wake_listening':
        return {
          dotColor: 'bg-[#22C55E]', // 🟢
          ringColor: 'ring-[#22C55E]/40',
          textColor: 'text-[#22C55E]',
          label: `Listening for "${wakeWord}"`,
          pillText: `Listening for "${wakeWord}"`,
          badge: '🟢 Ready',
          pulse: true
        };
      case 'user_listening':
      case 'cooldown':
        return {
          dotColor: 'bg-[#F97316]', // 🟠
          ringColor: 'ring-[#F97316]/40',
          textColor: 'text-[#F97316]',
          label: 'Listening to you...',
          pillText: 'Listening to you',
          badge: '🟠 User Speech',
          pulse: true
        };
      case 'processing':
        return {
          dotColor: 'bg-[#00D9FF]', // 🔵
          ringColor: 'ring-[#00D9FF]/40',
          textColor: 'text-[#00D9FF]',
          label: 'Thinking & retrieving knowledge...',
          pillText: 'Thinking',
          badge: '🔵 Processing',
          pulse: true
        };
      case 'greeting':
      case 'tts':
        return {
          dotColor: 'bg-[#C026D3]', // 🟣
          ringColor: 'ring-[#C026D3]/40',
          textColor: 'text-[#C026D3]',
          label: 'Life is speaking...',
          pillText: 'Speaking',
          badge: '🟣 Speaking',
          pulse: true
        };
      case 'error':
        return {
          dotColor: 'bg-[#EF4444]', // 🔴
          ringColor: 'ring-[#EF4444]/40',
          textColor: 'text-[#EF4444]',
          label: 'Voice service error',
          pillText: 'Error',
          badge: '🔴 Error',
          pulse: false
        };
      case 'stopped':
      default:
        return {
          dotColor: 'bg-[#94A3B8]', // ⚪
          ringColor: 'ring-[#94A3B8]/20',
          textColor: 'text-[#94A3B8]',
          label: 'Service stopped',
          pillText: 'Service stopped',
          badge: '⚪ Inactive',
          pulse: false
        };
    }
  };

  const statusConfig = getStatusConfig();

  const getOrbStyles = () => {
    switch (detailedState || state) {
      case 'user_listening':
      case 'listening':
        return 'scale-110 shadow-[0_0_60px_rgba(249,115,22,0.6),0_0_100px_rgba(0,217,255,0.5)] border-[#F97316] animate-pulse';
      case 'processing':
      case 'thinking':
        return 'scale-105 shadow-[0_0_55px_rgba(0,217,255,0.7),0_0_90px_rgba(139,92,246,0.6)] border-[#00D9FF]';
      case 'greeting':
      case 'tts':
      case 'speaking':
        return 'scale-108 shadow-[0_0_65px_rgba(192,38,211,0.6),0_0_90px_rgba(0,217,255,0.5)] border-[#C026D3] animate-bounce';
      case 'error':
        return 'shadow-[0_0_40px_rgba(239,68,68,0.5)] border-[#EF4444]';
      case 'wake_listening':
      case 'idle':
      default:
        return 'shadow-[0_0_40px_rgba(34,197,94,0.35),0_0_70px_rgba(0,217,255,0.25)] border-[#22C55E]/40 hover:scale-105 hover:shadow-[0_0_55px_rgba(0,217,255,0.5)]';
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-4 text-center select-none w-full">
      {/* Top Status Pill: Exact real status with color indicator */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-[#101722] border border-[#202B3D] text-[#F8FAFC] text-xs font-medium shadow-md">
          <span
            className={`w-3 h-3 rounded-full ring-2 ${statusConfig.ringColor} ${statusConfig.dotColor} ${
              statusConfig.pulse ? 'animate-pulse' : ''
            }`}
          />
          <span className="font-semibold text-slate-200">
            {statusConfig.pillText}
          </span>
        </div>
      </div>

      {/* Futuristic Glowing Orb Visualizer */}
      <div className="relative flex items-center justify-center my-2">
        {/* Ambient Glow Rays / Rings */}
        <div className="absolute w-56 h-56 rounded-full bg-gradient-to-r from-[#00A8FF]/20 via-[#00D9FF]/20 to-[#8B5CF6]/20 blur-2xl pointer-events-none" />

        {state === 'listening' && (
          <>
            <span className="absolute w-48 h-48 rounded-full bg-[#00D9FF]/20 animate-ping pointer-events-none" />
            <span className="absolute w-56 h-56 rounded-full border border-[#00D9FF]/30 animate-pulse pointer-events-none" />
          </>
        )}

        {/* Central Futuristic Sphere */}
        <button
          onClick={onManualTrigger}
          title="Tap to speak directly to Life AI"
          className={`relative z-10 w-36 h-36 rounded-full border-2 bg-gradient-to-tr from-[#00A8FF] via-[#0066FF] to-[#8B5CF6] transition-all duration-500 flex flex-col items-center justify-center cursor-pointer ${getOrbStyles()}`}
        >
          {/* Inner Gloss Overlay */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/25 via-transparent to-black/20 pointer-events-none" />

          {state === 'idle' && <Mic className="w-12 h-12 text-white mb-0.5 filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]" />}
          {state === 'listening' && <Mic className="w-13 h-13 text-white animate-pulse mb-0.5 filter drop-shadow-[0_0_12px_rgba(255,255,255,0.8)]" />}
          {state === 'thinking' && <Loader2 className="w-12 h-12 text-white animate-spin mb-0.5" />}
          {state === 'speaking' && <Volume2 className="w-12 h-12 text-white animate-pulse mb-0.5" />}

          <span className="text-[11px] font-bold tracking-widest uppercase text-white/90 drop-shadow">
            {state === 'idle' ? 'LIFE AI' : statusConfig.pillText}
          </span>
        </button>
      </div>

      {/* Status Description */}
      <p className="mt-5 text-sm font-medium text-slate-300 tracking-wide">
        {statusConfig.label}
      </p>

      {/* Quick Control Cards: Wake phrase & Hands-Free */}
      <div className="mt-5 grid grid-cols-2 gap-3 w-full max-w-sm">
        {/* Card 1: Wake phrase */}
        <div
          onClick={onToggleWakeWord}
          className="p-3 rounded-2xl bg-[#101722] border border-[#202B3D] flex items-center justify-between cursor-pointer hover:border-[#00D9FF]/40 transition-all text-left"
        >
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Wake phrase</span>
            <span className="text-xs font-semibold text-[#00D9FF] flex items-center gap-1 mt-0.5">
              <Sparkles className="w-3 h-3 text-[#00D9FF]" /> {wakeWord}
            </span>
          </div>
          <div className="text-[10px] px-2 py-0.5 rounded-md bg-[#00D9FF]/10 text-[#00D9FF] border border-[#00D9FF]/30 font-semibold">
            {wakeWordEnabled ? 'ON' : 'OFF'}
          </div>
        </div>

        {/* Card 2: Hands-Free */}
        <div
          onClick={onToggleHandsFree}
          className="p-3 rounded-2xl bg-[#101722] border border-[#202B3D] flex items-center justify-between cursor-pointer hover:border-[#8B5CF6]/40 transition-all text-left"
        >
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Hands-Free</span>
            <span className="text-xs font-semibold text-[#8B5CF6] flex items-center gap-1 mt-0.5">
              <Radio className="w-3 h-3 text-[#8B5CF6]" /> Screen Lock
            </span>
          </div>
          <button
            type="button"
            className={`w-9 h-5 rounded-full transition-colors relative flex items-center px-0.5 cursor-pointer ${
              isHandsFreeMode ? 'bg-[#22C55E]' : 'bg-slate-700'
            }`}
          >
            <span
              className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                isHandsFreeMode ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
};
