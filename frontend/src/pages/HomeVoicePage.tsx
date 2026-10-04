import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useVoice } from '../context/VoiceContext';
import { CompanionStage } from '../components/CompanionStage';
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
    detailedVoiceState,
    transcript,
    assistantResponse,
    isWakeWordEnabled,
    isHandsFreeMode,
    wakeWord,
    micPermissionError,
    isNativePlatform,
    isBatteryOptimizedExempt,
    requestBatteryOptimizationExemption,
    toggleWakeWord,
    toggleHandsFreeMode,
    triggerManualListen,
    requestMicPermission
  } = useVoice();

  const navigate = useNavigate();

  const [proactiveInsights, setProactiveInsights] = useState<any[]>([]);
  const [recommendation, setRecommendation] = useState<string>('');

  const [recentActivities, setRecentActivities] = useState<
    Array<{ query: string; reply: string; time: string; source?: string }>
  >([]);

  useEffect(() => {
    // Load proactive alerts and recommendation
    api.getGoalRecommendation()
      .then(res => {
        if (res?.recommendation) setRecommendation(res.recommendation);
      })
      .catch(() => {});

    api.getProactiveInsights()
      .then(ins => {
        if (Array.isArray(ins)) setProactiveInsights(ins);
      })
      .catch(() => {});

    // Fetch real recent conversation interactions
    api.getConversations()
      .then(async (convs) => {
        if (Array.isArray(convs) && convs.length > 0) {
          const latestConvs = convs.slice(0, 3);
          const realActs: Array<{ query: string; reply: string; time: string; source?: string }> = [];
          for (const c of latestConvs) {
            try {
              const full = await api.getConversation(c.id);
              if (full?.messages && full.messages.length >= 2) {
                const uMsg = [...full.messages].reverse().find((m) => m.role === 'user');
                const aMsg = [...full.messages].reverse().find((m) => m.role === 'assistant');
                if (uMsg && aMsg) {
                  realActs.push({
                    query: uMsg.content,
                    reply: aMsg.content,
                    time: new Date(aMsg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    source: c.title
                  });
                }
              }
            } catch {
              // ignore
            }
          }
          setRecentActivities(realActs);
        }
      })
      .catch(() => {});
  }, []);

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
      label: "Goals & Targets",
      icon: Brain,
      color: "text-[#00A8FF]",
      border: "border-[#00A8FF]/30",
      bg: "bg-[#00A8FF]/10",
      action: () => navigate('/goals')
    },
    {
      label: "Study Coach",
      icon: FileText,
      color: "text-[#8B5CF6]",
      border: "border-[#8B5CF6]/30",
      bg: "bg-[#8B5CF6]/10",
      action: () => navigate('/study')
    },
    {
      label: "Productivity",
      icon: Calendar,
      color: "text-[#C026D3]",
      border: "border-[#C026D3]/30",
      bg: "bg-[#C026D3]/10",
      action: () => navigate('/analytics')
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

      {/* Battery Optimization Advisory Banner for Android Background Reliability */}
      {isNativePlatform && !isBatteryOptimizedExempt && (
        <div className="w-full p-3 mb-3 rounded-2xl bg-[#141C28] border border-[#00D9FF]/30 text-slate-200 text-xs flex items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00D9FF] shrink-0 animate-pulse" />
            <span className="text-[11px] leading-tight">
              Disable battery optimization so <strong>"Hey Life"</strong> runs continuously in deep sleep.
            </span>
          </div>
          <button
            onClick={requestBatteryOptimizationExemption}
            className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-[#00A8FF] to-[#00D9FF] text-black font-bold text-[10px] shrink-0 hover:opacity-90 cursor-pointer shadow"
          >
            Disable
          </button>
        </div>
      )}

      {/* Proactive Insights Alert (if any active) */}
      {proactiveInsights.length > 0 && (
        <div className="w-full p-3 mb-3 rounded-2xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-2 truncate">
            <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 animate-ping" />
            <span className="truncate">
              <strong>{proactiveInsights[0].title}:</strong> {proactiveInsights[0].reason}
            </span>
          </div>
          <button
            onClick={() => navigate('/goals')}
            className="px-2.5 py-1 rounded-xl bg-amber-500 text-black font-bold text-[10px] shrink-0 hover:bg-amber-400 cursor-pointer"
          >
            Review
          </button>
        </div>
      )}

      {/* AI Daily Recommendation Card */}
      {recommendation && (
        <div className="w-full p-3 mb-4 rounded-2xl bg-gradient-to-r from-[#00A8FF]/10 to-[#8B5CF6]/10 border border-[#00D9FF]/25 text-slate-200 text-xs flex items-start gap-2.5 shadow-md">
          <Sparkles className="w-4 h-4 text-[#00D9FF] shrink-0 mt-0.5 animate-pulse" />
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#00D9FF]">Today's Recommendation</span>
            <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">{recommendation}</p>
          </div>
        </div>
      )}

      {/* Life AI Virtual Companion Stage (Primary Visual Reference) */}
      <CompanionStage onOpenChat={() => navigate('/chat')} />

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

        {recentActivities.length > 0 ? (
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
        ) : (
          <div className="p-4 rounded-2xl bg-[#0A0F18]/80 border border-[#202B3D] text-center space-y-1.5">
            <p className="text-xs font-semibold text-slate-300">No recent interactions yet</p>
            <p className="text-[11px] text-slate-400">
              Say "Hey Life" or tap the microphone above to begin speaking with your personal assistant.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};