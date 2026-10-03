import React from 'react';
import { Mic, MicOff, Volume2, Sparkles, Loader2, Radio } from 'lucide-react';
import { VoiceState } from '../types';

interface WakeWordIndicatorProps {
  state: VoiceState;
  wakeWordEnabled: boolean;
  isHandsFreeMode?: boolean;
  wakeWord?: string;
  onToggleWakeWord: () => void;
  onToggleHandsFree?: () => void;
  onManualTrigger: () => void;
}

export const WakeWordIndicator: React.FC<WakeWordIndicatorProps> = ({
  state,
  wakeWordEnabled,
  isHandsFreeMode = false,
  wakeWord = 'Hey Life',
  onToggleWakeWord,
  onToggleHandsFree,
  onManualTrigger
}) => {
  const getOrbStyles = () => {
    switch (state) {
      case 'listening':
        return 'border-orange-500 bg-orange-500/25 shadow-[0_0_55px_rgba(249,115,22,0.85)] scale-110';
      case 'thinking':
        return 'border-amber-400 bg-amber-500/20 shadow-[0_0_45px_rgba(251,191,36,0.65)] animate-pulse';
      case 'speaking':
        return 'border-orange-400 bg-gradient-to-r from-orange-600/35 to-amber-600/35 shadow-[0_0_65px_rgba(249,115,22,0.75)] animate-bounce';
      case 'idle':
      default:
        return 'border-gray-700 bg-gray-900/60 shadow-[0_0_20px_rgba(0,0,0,0.5)] hover:border-orange-500/50';
    }
  };

  const getStatusText = () => {
    switch (state) {
      case 'listening':
        return 'Listening to you...';
      case 'thinking':
        return 'Thinking & searching memories...';
      case 'speaking':
        return 'Life is speaking...';
      case 'idle':
      default:
        if (isHandsFreeMode) {
          return `Say "${wakeWord}" anytime (Screen locked or background)`;
        }
        return wakeWordEnabled ? `Say "${wakeWord}" to wake me` : 'Wake word paused';
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 text-center select-none">
      {/* Hands-Free Background Mode Badge */}
      <div className="mb-4">
        {isHandsFreeMode ? (
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Hands-Free Background Service Active</span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-800/60 border border-gray-700/60 text-gray-400 text-[11px] font-medium">
            <Radio className="w-3 h-3 text-gray-500" />
            <span>Hands-Free Mode: Standby</span>
          </div>
        )}
      </div>

      {/* Outer Pulse Rings */}
      <div className="relative flex items-center justify-center">
        {state === 'listening' && (
          <>
            <span className="absolute w-44 h-44 rounded-full bg-orange-500/20 animate-ping" />
            <span className="absolute w-52 h-52 rounded-full border border-orange-500/30 animate-pulse" />
          </>
        )}

        {/* Central Orb / Button */}
        <button
          onClick={onManualTrigger}
          title="Click to talk directly to Life"
          className={`relative z-10 w-32 h-32 rounded-full border-2 transition-all duration-500 flex flex-col items-center justify-center cursor-pointer ${getOrbStyles()}`}
        >
          {state === 'idle' && <Mic className="w-10 h-10 text-orange-400 mb-1" />}
          {state === 'listening' && <Mic className="w-12 h-12 text-orange-300 animate-pulse mb-1" />}
          {state === 'thinking' && <Loader2 className="w-10 h-10 text-amber-300 animate-spin mb-1" />}
          {state === 'speaking' && <Volume2 className="w-12 h-12 text-orange-200 animate-pulse mb-1" />}
          
          <span className="text-xs font-semibold tracking-wider uppercase text-orange-200/90">
            {state === 'idle' ? 'Life' : state}
          </span>
        </button>
      </div>

      {/* Status Label */}
      <div className="mt-5 flex items-center gap-2">
        {state === 'listening' && <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-ping" />}
        <p className="text-sm font-medium text-gray-300 tracking-wide">{getStatusText()}</p>
      </div>

      {/* Wake Word Subtitle / Toggle */}
      <div className="mt-3 flex items-center gap-2.5">
        <button
          onClick={onToggleWakeWord}
          className="text-xs px-3 py-1 rounded-full border border-gray-800 bg-[#16161c] hover:border-orange-500/40 text-gray-400 hover:text-orange-400 transition-all flex items-center gap-1.5 cursor-pointer"
        >
          {wakeWordEnabled ? (
            <>
              <Sparkles className="w-3 h-3 text-orange-400" />
              Wake phrase: <span className="font-semibold text-orange-300">"{wakeWord}"</span>
            </>
          ) : (
            <>
              <MicOff className="w-3 h-3 text-red-400" />
              Wake word paused
            </>
          )}
        </button>

        {onToggleHandsFree && (
          <button
            onClick={onToggleHandsFree}
            className={`text-xs px-3 py-1 rounded-full border transition-all flex items-center gap-1.5 cursor-pointer ${
              isHandsFreeMode
                ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300 hover:bg-emerald-900/40'
                : 'border-gray-800 bg-[#16161c] text-gray-400 hover:text-white hover:border-gray-700'
            }`}
          >
            <Radio className={`w-3 h-3 ${isHandsFreeMode ? 'text-emerald-400' : 'text-gray-500'}`} />
            Hands-Free: <span className="font-semibold">{isHandsFreeMode ? 'ON' : 'OFF'}</span>
          </button>
        )}
      </div>
    </div>
  );
};
