import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useVoice } from '../context/VoiceContext';
import { Sparkles, Radio, LogOut, Mic, MicOff } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const { isWakeWordEnabled, toggleWakeWord, voiceState } = useVoice();

  return (
    <header className="h-16 border-b border-white/[0.08] bg-[#09090d]/85 backdrop-blur-xl px-4 sm:px-6 flex items-center justify-between sticky top-0 z-40 shadow-sm shadow-black/20">
      {/* Brand & Companion Identity */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-orange-500 via-amber-500 to-rose-500 flex items-center justify-center shadow-[0_0_24px_rgba(249,115,22,0.35)] transition-transform hover:scale-105">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#09090d]" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white">
              Life
            </h1>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 font-semibold border border-orange-500/30">
              AI Companion
            </span>
          </div>
          <p className="text-[11px] text-gray-400 hidden sm:block">Private Long-Term Memory & Voice Assistant</p>
        </div>
      </div>

      {/* Center Voice / Wake-Word Status Pill */}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/[0.08] bg-[#13131b]/90 backdrop-blur-md shadow-inner">
        <div className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full transition-all ${
              voiceState === 'listening'
                ? 'bg-emerald-400 animate-ping'
                : voiceState === 'speaking'
                ? 'bg-orange-400 animate-pulse'
                : voiceState === 'thinking'
                ? 'bg-amber-400 animate-bounce'
                : isWakeWordEnabled
                ? 'bg-emerald-500'
                : 'bg-gray-500'
            }`}
          />
          <Radio className={`w-3.5 h-3.5 ${voiceState !== 'idle' ? 'text-orange-400 animate-pulse' : 'text-gray-400'}`} />
        </div>

        <span className="text-xs text-gray-300 hidden sm:inline">
          Wake word <span className="font-semibold text-orange-400">"Life"</span>
        </span>

        <button
          onClick={toggleWakeWord}
          className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full transition-all flex items-center gap-1 cursor-pointer ${
            isWakeWordEnabled
              ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40 hover:bg-orange-500/30'
              : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700'
          }`}
          title={isWakeWordEnabled ? 'Wake word active - Click to mute' : 'Wake word muted - Click to activate'}
        >
          {isWakeWordEnabled ? (
            <>
              <Mic className="w-3 h-3 text-orange-400" />
              <span>Active</span>
            </>
          ) : (
            <>
              <MicOff className="w-3 h-3 text-gray-400" />
              <span>Muted</span>
            </>
          )}
        </button>
      </div>

      {/* User Info & Sign Out */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-orange-600 to-amber-600 border border-orange-400/30 flex items-center justify-center text-white font-bold text-xs shadow-sm">
            {user?.preferred_name?.[0] || user?.username?.[0] || 'U'}
          </div>
          <span className="hidden md:inline text-xs font-medium text-gray-200">
            {user?.preferred_name || user?.username || 'Vikash'}
          </span>
        </div>

        <button
          onClick={logout}
          className="p-2 sm:px-3 sm:py-1.5 rounded-xl border border-white/[0.08] text-gray-400 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/10 transition-all flex items-center gap-1.5 text-xs cursor-pointer"
          title="Sign Out"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Sign Out</span>
        </button>
      </div>
    </header>
  );
};
