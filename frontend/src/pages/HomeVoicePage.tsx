import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
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
  Bot,
  Zap,
  Radio,
  Volume2
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export const HomeVoicePage: React.FC = () => {
  const { user } = useAuth();
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
          const latestConvs = convs.slice(0, 4);
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
      desc: "Voice or text query",
      icon: Sparkles,
      color: "text-[#00D9FF]",
      border: "border-[#00D9FF]/30",
      bg: "bg-[#00D9FF]/10",
      action: () => triggerManualListen()
    },
    {
      label: "Goals & Targets",
      desc: "Track your milestones",
      icon: Brain,
      color: "text-[#00A8FF]",
      border: "border-[#00A8FF]/30",
      bg: "bg-[#00A8FF]/10",
      action: () => navigate('/goals')
    },
    {
      label: "Study Coach",
      desc: "Flashcards & quiz",
      icon: FileText,
      color: "text-[#8B5CF6]",
      border: "border-[#8B5CF6]/30",
      bg: "bg-[#8B5CF6]/10",
      action: () => navigate('/study')
    },
    {
      label: "Productivity",
      desc: "Daily metrics & habit",
      icon: Calendar,
      color: "text-[#C026D3]",
      border: "border-[#C026D3]/30",
      bg: "bg-[#C026D3]/10",
      action: () => navigate('/analytics')
    }
  ];

  const displayName = user?.preferred_name || (user?.full_name ? user.full_name.split(' ')[0] : (user?.username || 'Jeet'));

  return (
    <div className="flex-1 overflow-y-auto w-full p-4 sm:p-6 lg:p-8 pb-28 md:pb-8 min-h-0 select-none">
      <div className="max-w-7xl mx-auto w-full space-y-6">

        {/* Advisory and Permission Alerts */}
        {micPermissionError && (
          <div className="w-full p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-center justify-between gap-3 shadow-lg">
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

        {isNativePlatform && !isBatteryOptimizedExempt && (
          <div className="w-full p-3 rounded-2xl bg-[#141C28] border border-[#00D9FF]/30 text-slate-200 text-xs flex items-center justify-between gap-3 shadow-md">
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
          <div className="w-full p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-transparent border border-amber-500/35 text-amber-200 text-xs flex items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-2.5 truncate">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0 animate-ping" />
              <span className="truncate">
                <strong className="text-amber-300 font-semibold">{proactiveInsights[0].title}:</strong> {proactiveInsights[0].reason}
              </span>
            </div>
            <button
              onClick={() => navigate('/goals')}
              className="px-3 py-1.5 rounded-xl bg-amber-500 text-black font-bold text-[10px] shrink-0 hover:bg-amber-400 cursor-pointer shadow"
            >
              Review
            </button>
          </div>
        )}

        {/* Responsive Dual-Column Grid on Desktop / Single Column on Mobile */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start w-full min-w-0">
          
          {/* ============================================================== */}
          {/* COLUMN 1 (HERO): VIRTUAL COMPANION STAGE (CENTERPIECE FOCUS)    */}
          {/* ============================================================== */}
          <div className="lg:col-span-7 xl:col-span-7 flex flex-col items-center justify-center w-full min-w-0">
            {/* Companion Stage (Responsive size, up to 580px on desktop) */}
            <CompanionStage onOpenChat={() => navigate('/chat')} />
          </div>

          {/* ============================================================== */}
          {/* COLUMN 2: COMMAND STATION, ACTIONS & RECENT ACTIVITY            */}
          {/* ============================================================== */}
          <div className="lg:col-span-5 xl:col-span-5 flex flex-col space-y-5 w-full min-w-0">
            
            {/* Welcome & Companion Status Card */}
            <div className="p-5 rounded-3xl bg-[#101722]/90 border border-[#202B3D] backdrop-blur-xl shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight">
                    Hello, <span className="text-[#00D9FF]">{displayName}</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">Your personal AI companion is ready.</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border flex items-center gap-1.5 ${
                    isWakeWordEnabled
                      ? 'bg-[#22C55E]/15 border-[#22C55E]/40 text-[#22C55E]'
                      : 'bg-slate-800/60 border-slate-700 text-slate-400'
                  }`}>
                    <Radio className="w-3 h-3" />
                    <span>{isWakeWordEnabled ? `"${wakeWord}" Active` : 'Muted'}</span>
                  </div>
                </div>
              </div>

              {/* AI Daily Recommendation Card */}
              {recommendation ? (
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-[#00A8FF]/15 to-[#8B5CF6]/15 border border-[#00D9FF]/30 text-slate-200 text-xs flex items-start gap-3 shadow-inner">
                  <Sparkles className="w-4 h-4 text-[#00D9FF] shrink-0 mt-0.5 animate-pulse" />
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#00D9FF]">Today's Focus</span>
                    <p className="text-xs text-slate-200 leading-relaxed">{recommendation}</p>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-2xl bg-[#141C28] border border-[#202B3D] text-xs text-slate-400 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#00D9FF]" />
                  <span>Ask anything or say "Hey Life" to set today's focus.</span>
                </div>
              )}
            </div>

            {/* Quick Actions Grid */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-400 px-1 uppercase tracking-wider text-[10px]">
                Quick Launchpad
              </span>
              <div className="grid grid-cols-2 gap-3">
                {quickActions.map((action, idx) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={idx}
                      onClick={action.action}
                      className="p-3.5 rounded-2xl bg-[#101722] border border-[#202B3D] hover:border-[#00D9FF]/40 hover:bg-[#141C28] transition-all flex items-center gap-3 text-left cursor-pointer group shadow-sm"
                    >
                      <div className={`w-9 h-9 rounded-xl ${action.bg} ${action.border} border flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform`}>
                        <Icon className={`w-4.5 h-4.5 ${action.color}`} />
                      </div>
                      <div className="truncate flex-1">
                        <span className="text-xs font-semibold text-slate-200 group-hover:text-white truncate block">
                          {action.label}
                        </span>
                        <span className="text-[10px] text-slate-500 truncate block">
                          {action.desc}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Recent Voice Activity Section */}
            <div className="space-y-2.5">
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
                      className="p-3 rounded-2xl bg-[#101722] border border-[#202B3D] hover:border-[#00D9FF]/30 hover:bg-[#141C28] transition-all flex items-center justify-between gap-3 cursor-pointer group shadow-sm"
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
                    Say "Hey Life" or tap the microphone to speak with your companion.
                  </p>
                </div>
              )}
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};