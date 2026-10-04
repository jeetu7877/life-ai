import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useVoice } from '../context/VoiceContext';
import { Sparkles, Radio, LogOut, Mic, MicOff } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const { isWakeWordEnabled, toggleWakeWord, voiceState } = useVoice();

  return (
    <header className="h-16 border-b border-[#202B3D] bg-[#05070B]/90 backdrop-blur-xl px-4 sm:px-6 flex items-center justify-between sticky top-0 z-40">
      {/* Brand & Companion Identity */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#00A8FF] via-[#00D9FF] to-[#8B5CF6] flex items-center justify-center shadow-[0_0_20px_rgba(0,217,255,0.4)] transition-transform hover:scale-105">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#22C55E] border-2 border-[#05070B]" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[#F8FAFC]">
              Life AI
            </h1>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#00D9FF]/10 text-[#00D9FF] font-semibold border border-[#00D9FF]/30 hidden xs:inline-block">
              Companion
            </span>
          </div>
          <p className="text-[11px] text-[#94A3B8] hidden sm:block">Your Personal AI Companion</p>
        </div>
      </div>

      {/* Center Voice / Wake-Word Status Pill */}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#202B3D] bg-[#0A0F18]/90 backdrop-blur-md shadow-inner">
        <div className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full transition-all ${
              voiceState === 'listening'
                ? 'bg-[#00D9FF] animate-ping'
                : voiceState === 'speaking'
                ? 'bg-[#8B5CF6] animate-pulse'
                : voiceState === 'thinking'
                ? 'bg-[#00A8FF] animate-bounce'
                : isWakeWordEnabled
                ? 'bg-[#22C55E]'
                : 'bg-slate-600'
            }`}
          />
          <Radio className={`w-3.5 h-3.5 ${voiceState !== 'idle' ? 'text-[#00D9FF] animate-pulse' : 'text-slate-400'}`} />
        </div>

        <span className="text-xs text-slate-300 hidden sm:inline">
          Wake word <span className="font-semibold text-[#00D9FF]">"Hey Life"</span>
        </span>

        <button
          onClick={toggleWakeWord}
          className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full transition-all flex items-center gap-1 cursor-pointer ${
            isWakeWordEnabled
              ? 'bg-[#00D9FF]/15 text-[#00D9FF] border border-[#00D9FF]/40 hover:bg-[#00D9FF]/25'
              : 'bg-[#141C28] text-slate-400 border border-[#202B3D] hover:bg-[#1A2332]'
          }`}
          title={isWakeWordEnabled ? 'Wake word active - Click to mute' : 'Wake word muted - Click to activate'}
        >
          {isWakeWordEnabled ? (
            <>
              <Mic className="w-3 h-3 text-[#00D9FF]" />
              <span>Active</span>
            </>
          ) : (
            <>
              <MicOff className="w-3 h-3 text-slate-400" />
              <span>Muted</span>
            </>
          )}
        </button>
      </div>

      {/* User Info & Sign Out */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-[#101722] border border-[#202B3D]">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#00A8FF] to-[#8B5CF6] border border-[#00D9FF]/30 flex items-center justify-center text-white font-bold text-xs shadow-sm">
            {user?.preferred_name?.[0] || user?.username?.[0] || 'J'}
          </div>
          <span className="hidden md:inline text-xs font-medium text-slate-200">
            {user?.preferred_name || user?.username || 'Vikash'}
          </span>
        </div>

        <button
          onClick={logout}
          className="p-2 sm:px-3 sm:py-1.5 rounded-xl border border-[#202B3D] text-slate-400 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/10 transition-all flex items-center gap-1.5 text-xs cursor-pointer"
          title="Sign Out"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Sign Out</span>
        </button>
      </div>
    </header>
  );
};
