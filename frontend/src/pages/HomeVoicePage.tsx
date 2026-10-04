import React, { useState } from 'react';
import { useVoice } from '../context/VoiceContext';
import { WakeWordIndicator } from '../components/WakeWordIndicator';
import { VoiceWaveform } from '../components/VoiceWaveform';
import {
  Sparkles,
  FileText,
  Brain,
  Calendar,
  Clock,
  ShieldAlert,
  Mic,
  ArrowRight,
  ChevronRight,
  Bot
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export const HomeVoicePage: React.FC = () => {
  const {
    voiceState,
    transcript,
    assistantResponse,
    isWakeWordEnabled,
    isHandsFreeMode,
    wakeWord,
    micPermissionError,
    toggleWakeWord,
    toggleHandsFreeMode,
    triggerManualListen,
    requestMicPermission
  } = useVoice();

  const navigate = useNavigate();

  // Recent voice activities (dynamic + fallback history items)
  const [recentActivities] = useState([
    {
      query: "Mera roll number kya hai?",
      reply: "Tumhara roll number 24103068 hai (College ID).",
      time: "2m ago",
      source: "College ID"
    },
    {
      query: "Meri bestie ka naam kya hai?",
      reply: "Tumhari bestie ka naam Niku hai.",
      time: "15m ago",
      source: "Memory"
    },
    {
      query: "What are my DBMS marks?",
      reply: "You scored 88/100 in DBMS Semester 5.",
      time: "1h ago",
      source: "Marksheet"
    }
  ]);

  const quickActions = [
    {
      label: "Ask Anything",
      icon: Sparkles,
      color: "text-[#00D9FF]",
      border: "border-[#00D9FF]/30",
      bg: "bg-[#00D9FF]/10",
      action: () => triggerManualListen()
    },
    {
      label: "Your Documents",
      icon: FileText,
      color: "text-[#00A8FF]",
      border: "border-[#00A8FF]/30",
      bg: "bg-[#00A8FF]/10",
      action: () => navigate('/documents')
    },
    {
      label: "Personal Memory",
      icon: Brain,
      color: "text-[#8B5CF6]",
      border: "border-[#8B5CF6]/30",
      bg: "bg-[#8B5CF6]/10",
      action: () => navigate('/memories')
    },
    {
      label: "Daily Updates",
      icon: Calendar,
      color: "text-[#C026D3]",
      border: "border-[#C026D3]/30",
      bg: "bg-[#C026D3]/10",
      action: () => navigate('/timeline')
    }
  ];

  return (
    <div className="flex-1 overflow-y-auto w-full p-4 sm:p-6 max-w-xl mx-auto flex flex-col items-center justify-between pb-28 md:pb-8 min-h-0">
      {/* Mic Permission Warning Banner if blocked */}
      {micPermissionError && (
        <div className="w-full p-3.5 mb-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
            <span>
              Microphone permission is required for <strong>"{wakeWord}"</strong>. Click allow to enable voice recognition.
            </span>
          </div>
          <button
            onClick={requestMicPermission}
            className="px-3 py-1.5 rounded-xl bg-amber-500 text-black font-bold text-[11px] shrink-0 hover:bg-amber-400 cursor-pointer"
          >
            Allow Mic
          </button>
        </div>
      )}

      {/* Futuristic Centerpiece: Glowing Orb */}
      <div className="w-full flex flex-col items-center">
        <WakeWordIndicator
          state={voiceState}
          wakeWordEnabled={isWakeWordEnabled}
          isHandsFreeMode={isHandsFreeMode}
          wakeWord={wakeWord}
          onToggleWakeWord={toggleWakeWord}
          onToggleHandsFree={toggleHandsFreeMode}
          onManualTrigger={triggerManualListen}
        />

        {/* Live Audio Waveform */}
        <div className="mt-2">
          <VoiceWaveform isActive={voiceState === 'listening' || voiceState === 'speaking'} />
        </div>

        {/* Live Speech Feedback Area */}
        {(voiceState !== 'idle' || transcript || assistantResponse) && (
          <div className="w-full mt-4 p-4 rounded-2xl border border-[#202B3D] bg-[#101722]/90 backdrop-blur-md flex flex-col justify-center text-center shadow-lg transition-all">
            {voiceState === 'listening' && (
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#00D9FF]">Live Speech Input</span>
                <p className="text-sm text-slate-100 font-medium italic">
                  "{transcript || 'Listening... Speak now'}"
                </p>
              </div>
            )}

            {voiceState === 'thinking' && (
              <div className="flex items-center justify-center gap-2 text-[#8B5CF6] text-xs font-medium py-1">
                <span className="w-2 h-2 rounded-full bg-[#8B5CF6] animate-ping" />
                Querying memory vault & document intelligence...
              </div>
            )}

            {voiceState === 'speaking' && (
              <div className="space-y-1">
                <span className="text-[10px] uppercase tracking-wider font-bold text-[#00D9FF]">Life AI Response</span>
                <p className="text-xs text-slate-200 font-normal leading-relaxed">{assistantResponse}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4 Quick Action Pills / Cards */}
      <div className="w-full mt-6 space-y-2">
        <div className="grid grid-cols-2 gap-2.5">
          {quickActions.map((action, idx) => {
            const Icon = action.icon;
            return (
              <button
                key={idx}
                onClick={action.action}
                className="p-3 rounded-2xl bg-[#101722] border border-[#202B3D] hover:border-[#00D9FF]/40 hover:bg-[#141C28] transition-all flex items-center gap-2.5 text-left cursor-pointer group"
              >
                <div className={`w-8 h-8 rounded-xl ${action.bg} ${action.border} border flex items-center justify-center shrink-0`}>
                  <Icon className={`w-4 h-4 ${action.color}`} />
                </div>
                <div className="truncate flex-1">
                  <span className="text-xs font-semibold text-slate-200 group-hover:text-white truncate block">
                    {action.label}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Recent Voice Activity Section */}
      <div className="w-full mt-6 space-y-2.5">
        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
          <span className="font-semibold text-xs text-slate-300 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[#00D9FF]" /> Recent Voice Activity
          </span>
          <Link to="/chat" className="text-[#00D9FF] hover:text-[#00A8FF] flex items-center gap-1 font-medium text-xs">
            Open Chat <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="space-y-2">
          {recentActivities.map((item, idx) => (
            <div
              key={idx}
              onClick={() => navigate('/chat')}
              className="p-3 rounded-2xl bg-[#101722] border border-[#202B3D] hover:border-[#00D9FF]/30 transition-all flex items-center justify-between gap-3 cursor-pointer group"
            >
              <div className="flex items-center gap-3 truncate">
                <div className="w-8 h-8 rounded-xl bg-[#141C28] border border-[#202B3D] flex items-center justify-center text-[#00D9FF] shrink-0">
                  <Mic className="w-3.5 h-3.5" />
                </div>
                <div className="truncate">
                  <p className="text-xs font-semibold text-slate-200 group-hover:text-[#00D9FF] transition-colors truncate">
                    "{item.query}"
                  </p>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">
                    {item.reply}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] text-slate-500 font-mono">{item.time}</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};