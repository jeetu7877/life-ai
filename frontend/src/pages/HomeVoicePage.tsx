import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useVoice } from '../context/VoiceContext';
import { LivingAvatar } from '../components/LivingAvatar';
import { VoiceWaveform } from '../components/VoiceWaveform';
import { VoiceDiagnosticsModal } from '../components/VoiceDiagnosticsModal';
import {
  Sparkles,
  FileText,
  Brain,
  Mic,
  MicOff,
  ChevronRight,
  AlarmClock,
  Music,
  FolderGit2,
  Image as ImageIcon,
  MessageSquare,
  Activity,
  Code2,
  Copy,
  Check,
  Volume2,
  RotateCcw,
  ThumbsUp,
  ThumbsDown,
  Keyboard,
  SlidersHorizontal,
  LineChart,
  Target,
  X,
  ShieldCheck,
  Radio
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export const HomeVoicePage: React.FC = () => {
  const { user } = useAuth();
  const {
    voiceState,
    detailedVoiceState,
    transcript,
    assistantResponse,
    isVoiceModeEnabled,
    isConversationActive,
    isWakeWordEnabled,
    wakeWord,
    audioEnergy,
    inputVolume,
    isAudioSpeaking,
    micPermissionError,
    micPermissionGranted,
    isNativePlatform,
    isBatteryOptimizedExempt,
    requestBatteryOptimizationExemption,
    toggleVoiceMode,
    toggleWakeWord,
    triggerManualListen,
    requestMicPermission,
    setIsDiagnosticsOpen,
    playAudioResponse
  } = useVoice();

  const navigate = useNavigate();

  // Active top tab state
  const [activeTab, setActiveTab] = useState<'companion' | 'vision' | 'memory'>('companion');

  // Voice Tuner Modal state
  const [isTunerOpen, setIsTunerOpen] = useState<boolean>(false);

  // Interaction feedback states
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<'liked' | 'disliked' | null>(null);

  // Real or active conversation display in the Glass Card
  const [cardUserText, setCardUserText] = useState<string>('pahle kya kar rahi');
  const [cardAiText, setCardAiText] = useState<string>(
    'Main toh bas yahin hoon, aapka intezaar kar rahi thi!'
  );
  const [cardTime, setCardTime] = useState<string>(() => {
    return new Date().toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  });

  // Next Alarm display in Today's Focus
  const [nextAlarmText, setNextAlarmText] = useState<string>('Tomorrow 6:00 AM');

  const displayName =
    user?.preferred_name ||
    (user?.full_name ? user.full_name.split(' ')[0] : (user?.username || 'Jeet'));

  // Sync live voice transcripts and assistant responses into the conversation card
  useEffect(() => {
    if (transcript && transcript.trim()) {
      setCardUserText(transcript.trim());
      setCardTime(
        new Date().toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        })
      );
    }
  }, [transcript]);

  useEffect(() => {
    if (assistantResponse && assistantResponse.trim()) {
      setCardAiText(assistantResponse.trim());
      setCardTime(
        new Date().toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        })
      );
    }
  }, [assistantResponse]);

  // Load real recent conversations and alarms on mount
  useEffect(() => {
    api
      .getConversations()
      .then(async (convs) => {
        if (Array.isArray(convs) && convs.length > 0) {
          try {
            const full = await api.getConversation(convs[0].id);
            if (full?.messages && full.messages.length >= 2) {
              const uMsg = [...full.messages].reverse().find((m) => m.role === 'user');
              const aMsg = [...full.messages].reverse().find((m) => m.role === 'assistant');
              if (uMsg && aMsg) {
                setCardUserText(uMsg.content);
                setCardAiText(aMsg.content);
                setCardTime(
                  new Date(aMsg.timestamp).toLocaleTimeString('en-IN', {
                    timeZone: 'Asia/Kolkata',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  })
                );
              }
            }
          } catch (_) {}
        }
      })
      .catch(() => {});

    // Try fetching active alarms for Today's Focus card
    api
      .getAlarms()
      .then((res: any) => {
        const alarms = Array.isArray(res) ? res : res?.alarms;
        if (Array.isArray(alarms) && alarms.length > 0) {
          const active = alarms.find((a: any) => a.is_active !== false);
          if (active) {
            setNextAlarmText(`${active.time || '6:00 AM'}${active.label ? ` • ${active.label}` : ''}`);
          }
        }
      })
      .catch(() => {});
  }, []);

  const handleCopy = () => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(cardAiText);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const handleReplay = () => {
    if (cardAiText) {
      playAudioResponse('', cardAiText);
    }
  };

  const handleRegenerate = async () => {
    if (cardUserText) {
      try {
        const res = await api.sendMessage({
          content: cardUserText,
          timezone: 'Asia/Kolkata',
          voice_mode: true
        });
        if (res?.response) {
          setCardAiText(res.response);
          playAudioResponse(res.audio_url || '', res.response);
        }
      } catch (_) {}
    }
  };

  // Determine real status bar label & dot color
  const getStatusBarMeta = () => {
    if (!isVoiceModeEnabled) {
      return {
        label: 'Voice • Off',
        dotClass: 'bg-slate-500',
        ringClass: ''
      };
    }
    switch (voiceState) {
      case 'listening':
        return {
          label: detailedVoiceState === 'speech_detected' ? 'Hearing you...' : `Listening • ${wakeWord}`,
          dotClass: 'bg-[#22C55E] animate-pulse',
          ringClass: 'ring-2 ring-[#22C55E]/40'
        };
      case 'thinking':
        return {
          label: 'Thinking...',
          dotClass: 'bg-[#00D9FF] animate-bounce',
          ringClass: 'ring-2 ring-[#00D9FF]/40'
        };
      case 'speaking':
        return {
          label: 'Speaking...',
          dotClass: 'bg-[#C084FC] animate-ping',
          ringClass: 'ring-2 ring-[#C084FC]/40'
        };
      default:
        return {
          label: isWakeWordEnabled ? `Listening • ${wakeWord}` : `Ready • Tap Mic`,
          dotClass: 'bg-[#22C55E]',
          ringClass: ''
        };
    }
  };

  const statusMeta = getStatusBarMeta();

  return (
    <div className="flex-1 overflow-y-auto w-full max-w-full min-w-0 px-3 sm:px-6 lg:px-8 py-3 pb-24 sm:pb-28 min-h-0 select-none box-border font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="max-w-md sm:max-w-xl md:max-w-2xl lg:max-w-3xl xl:max-w-4xl mx-auto w-full space-y-4 sm:space-y-5">

        {/* ============================================================== */}
        {/* 1. TOP SEGMENTED CONTROL TABS (Companion | AI Vision | Memory) */}
        {/* ============================================================== */}
        <div className="w-full flex items-center justify-center pt-1">
          <div className="flex items-center gap-1 p-1 rounded-2xl bg-[#090E17]/90 border border-[#1A2536] shadow-xl w-full max-w-md">
            <button
              type="button"
              onClick={() => setActiveTab('companion')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === 'companion'
                  ? 'bg-gradient-to-r from-[#00A8FF] via-[#00D9FF]/80 to-[#8B5CF6] text-white shadow-[0_0_18px_rgba(0,217,255,0.4)] border border-[#00D9FF]/50'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Companion</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/vision')}
              className="flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 text-slate-400 hover:text-white hover:bg-[#141C28] transition-all cursor-pointer"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>AI Vision</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/memories')}
              className="flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 text-slate-400 hover:text-white hover:bg-[#141C28] transition-all cursor-pointer"
            >
              <Brain className="w-3.5 h-3.5" />
              <span>Memory</span>
            </button>
          </div>
        </div>

        {/* ============================================================== */}
        {/* 2. VOICE STATUS BAR (State Pill • Waveform • Diag Button)      */}
        {/* ============================================================== */}
        <div className="w-full flex items-center justify-between gap-2 px-1">
          {/* Left: Dynamic Live Voice State Pill */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#080E18] border border-[#1D2A3D] text-xs font-semibold text-slate-200 shadow-sm shrink-0">
            <span className={`w-2 h-2 rounded-full ${statusMeta.dotClass} ${statusMeta.ringClass}`} />
            <span className="text-[11px] sm:text-xs tracking-tight text-white font-medium">
              {statusMeta.label}
            </span>
          </div>

          {/* Center: Animated Equalizer Waveform */}
          <div className="flex-1 flex items-center justify-center px-1 overflow-hidden">
            <VoiceWaveform
              isActive={voiceState !== 'idle' || isVoiceModeEnabled}
              inputVolume={inputVolume}
              audioEnergy={audioEnergy}
              color="from-[#00D9FF] via-[#00A8FF] to-[#A855F7]"
            />
          </div>

          {/* Right: Diag Button */}
          <button
            type="button"
            onClick={() => setIsDiagnosticsOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#080E18] hover:bg-[#121B2A] border border-[#1D2A3D] hover:border-[#00D9FF]/40 text-[11px] sm:text-xs font-semibold text-slate-300 hover:text-white transition-all cursor-pointer shadow-sm shrink-0"
            title="Open Audio & Voice Diagnostics"
          >
            <LineChart className="w-3.5 h-3.5 text-[#00D9FF]" />
            <span>Diag</span>
          </button>
        </div>

        {/* Microphone permission alert banner (if permission denied) */}
        {micPermissionError && (
          <div className="w-full p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-center justify-between gap-3 shadow-lg">
            <span>Microphone permission required for hands-free listening.</span>
            <button
              onClick={requestMicPermission}
              className="px-3 py-1 rounded-xl bg-amber-500 text-black font-bold text-xs shrink-0 cursor-pointer"
            >
              Allow Mic
            </button>
          </div>
        )}

        {/* ============================================================== */}
        {/* 3. HERO AI COMPANION CENTERPIECE                               */}
        {/* ============================================================== */}
        <div className="relative w-full flex items-center justify-center py-2 sm:py-4">
          {/* Holographic Glowing Stage Container */}
          <div className="relative flex items-center justify-center">

            {/* Concentric Neon Rings & Aura Glow */}
            <div className="absolute inset-0 -m-6 sm:-m-10 rounded-full bg-gradient-to-tr from-[#00D9FF]/20 via-[#00A8FF]/10 to-[#8B5CF6]/20 blur-2xl pointer-events-none" />

            {/* Circular Sound Waves & Holographic Outer Ring */}
            <div className="absolute w-[240px] h-[240px] sm:w-[310px] sm:h-[310px] rounded-full border border-[#00D9FF]/40 shadow-[0_0_35px_rgba(0,217,255,0.35)] flex items-center justify-center pointer-events-none animate-pulse">
              <div className="w-[210px] h-[210px] sm:w-[280px] sm:h-[280px] rounded-full border border-[#8B5CF6]/30 shadow-[inset_0_0_20px_rgba(139,92,246,0.25)]" />
            </div>

            {/* Floating Speech Bubble on the Left */}
            <div className="absolute -left-3 sm:-left-12 top-6 sm:top-10 z-20 max-w-[155px] sm:max-w-[195px] p-2.5 sm:p-3 rounded-2xl bg-[#090E18]/95 border border-[#00D9FF]/40 shadow-[0_0_20px_rgba(0,217,255,0.25)] backdrop-blur-xl animate-fadeIn">
              <p className="text-[11px] sm:text-xs text-slate-100 font-medium leading-snug">
                Hey {displayName},<br />
                I'm here. What<br />
                can I help you with?
              </p>
              {/* Pointer triangle pointing to avatar */}
              <div className="absolute -right-2 top-4 w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-[8px] border-l-[#00D9FF]/50" />
            </div>

            {/* Living Anime Avatar Centerpiece */}
            <div className="relative z-10 w-[190px] h-[190px] sm:w-[250px] sm:h-[250px] rounded-full overflow-hidden border-2 border-[#00D9FF] shadow-[0_0_30px_rgba(0,217,255,0.5)] bg-[#05070B] cursor-pointer"
                 onClick={() => triggerManualListen()}
            >
              <LivingAvatar
                voiceState={voiceState}
                detailedVoiceState={detailedVoiceState}
                isConversationActive={isConversationActive}
                isWakeWordEnabled={isWakeWordEnabled}
                inputVolume={inputVolume}
                className="w-full h-full object-cover scale-105"
              />
            </div>

          </div>
        </div>

        {/* ============================================================== */}
        {/* 4. LATEST CONVERSATION CARD (YOU & LIFE AI with Action Icons)  */}
        {/* ============================================================== */}
        <div className="w-full p-4 sm:p-5 rounded-3xl bg-[#0A101C]/90 border border-[#1A2638] backdrop-blur-xl shadow-xl space-y-3.5 transition-all">
          
          {/* User Utterance */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 font-bold text-[#00D9FF]">
                <Mic className="w-3.5 h-3.5 text-[#00D9FF]" />
                <span className="tracking-wider text-[11px]">YOU</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">{cardTime}</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 italic pl-5">
              "{cardUserText}"
            </p>
          </div>

          {/* Thin subtle divider */}
          <div className="h-px w-full bg-[#1A2638]" />

          {/* Life AI Response */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 font-bold text-[#C084FC]">
                <Sparkles className="w-3.5 h-3.5 text-[#C084FC]" />
                <span className="tracking-wider text-[11px]">LIFE AI</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">{cardTime}</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed pl-5 font-normal">
              {cardAiText}
            </p>

            {/* Conversation Card Actions (Right-aligned below response) */}
            <div className="flex items-center justify-end gap-1.5 pt-1">
              <button
                type="button"
                onClick={handleCopy}
                className="p-1.5 rounded-lg bg-[#0E1624] hover:bg-[#162236] border border-[#1D2A3D] text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Copy response"
              >
                {isCopied ? <Check className="w-3.5 h-3.5 text-[#22C55E]" /> : <Copy className="w-3.5 h-3.5" />}
              </button>

              <button
                type="button"
                onClick={handleReplay}
                className="p-1.5 rounded-lg bg-[#0E1624] hover:bg-[#162236] border border-[#1D2A3D] text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Speak / Replay audio"
              >
                <Volume2 className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={handleRegenerate}
                className="p-1.5 rounded-lg bg-[#0E1624] hover:bg-[#162236] border border-[#1D2A3D] text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Regenerate response"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setFeedback(feedback === 'liked' ? null : 'liked')}
                className={`p-1.5 rounded-lg bg-[#0E1624] hover:bg-[#162236] border border-[#1D2A3D] transition-colors cursor-pointer ${
                  feedback === 'liked' ? 'text-[#00D9FF] border-[#00D9FF]/40' : 'text-slate-400 hover:text-white'
                }`}
                title="Like"
              >
                <ThumbsUp className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setFeedback(feedback === 'disliked' ? null : 'disliked')}
                className={`p-1.5 rounded-lg bg-[#0E1624] hover:bg-[#162236] border border-[#1D2A3D] transition-colors cursor-pointer ${
                  feedback === 'disliked' ? 'text-rose-400 border-rose-500/40' : 'text-slate-400 hover:text-white'
                }`}
                title="Dislike"
              >
                <ThumbsDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

        </div>

        {/* ============================================================== */}
        {/* 5. QUICK ACTIONS GRID (2 Rows x 3 Cols = 6 Buttons)             */}
        {/* ============================================================== */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3 w-full">
          {/* Row 1 */}
          <button
            type="button"
            onClick={() => navigate('/chat')}
            className="p-3 sm:p-3.5 rounded-2xl bg-[#0A101C] hover:bg-[#111A2C] border border-[#1D2A3D] hover:border-[#00D9FF]/40 transition-all flex items-center gap-2.5 cursor-pointer shadow-sm group"
          >
            <div className="w-8 h-8 rounded-xl bg-[#00D9FF]/10 border border-[#00D9FF]/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <MessageSquare className="w-4 h-4 text-[#00D9FF]" />
            </div>
            <span className="text-xs sm:text-sm font-semibold text-slate-200 group-hover:text-white truncate">
              Chat
            </span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/vision')}
            className="p-3 sm:p-3.5 rounded-2xl bg-[#0A101C] hover:bg-[#111A2C] border border-[#1D2A3D] hover:border-[#C084FC]/40 transition-all flex items-center gap-2.5 cursor-pointer shadow-sm group"
          >
            <div className="w-8 h-8 rounded-xl bg-[#C084FC]/10 border border-[#C084FC]/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <ImageIcon className="w-4 h-4 text-[#C084FC]" />
            </div>
            <span className="text-xs sm:text-sm font-semibold text-slate-200 group-hover:text-white truncate">
              Ask Photo
            </span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/music')}
            className="p-3 sm:p-3.5 rounded-2xl bg-[#0A101C] hover:bg-[#111A2C] border border-[#1D2A3D] hover:border-[#F472B6]/40 transition-all flex items-center gap-2.5 cursor-pointer shadow-sm group"
          >
            <div className="w-8 h-8 rounded-xl bg-[#F472B6]/10 border border-[#F472B6]/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Music className="w-4 h-4 text-[#F472B6]" />
            </div>
            <span className="text-xs sm:text-sm font-semibold text-slate-200 group-hover:text-white truncate">
              Music
            </span>
          </button>

          {/* Row 2 */}
          <button
            type="button"
            onClick={() => navigate('/alarms')}
            className="p-3 sm:p-3.5 rounded-2xl bg-[#0A101C] hover:bg-[#111A2C] border border-[#1D2A3D] hover:border-[#38BDF8]/40 transition-all flex items-center gap-2.5 cursor-pointer shadow-sm group"
          >
            <div className="w-8 h-8 rounded-xl bg-[#38BDF8]/10 border border-[#38BDF8]/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <AlarmClock className="w-4 h-4 text-[#38BDF8]" />
            </div>
            <span className="text-xs sm:text-sm font-semibold text-slate-200 group-hover:text-white truncate">
              Alarms
            </span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/documents')}
            className="p-3 sm:p-3.5 rounded-2xl bg-[#0A101C] hover:bg-[#111A2C] border border-[#1D2A3D] hover:border-[#A855F7]/40 transition-all flex items-center gap-2.5 cursor-pointer shadow-sm group"
          >
            <div className="w-8 h-8 rounded-xl bg-[#A855F7]/10 border border-[#A855F7]/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <FileText className="w-4 h-4 text-[#A855F7]" />
            </div>
            <span className="text-xs sm:text-sm font-semibold text-slate-200 group-hover:text-white truncate">
              Documents
            </span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/github')}
            className="p-3 sm:p-3.5 rounded-2xl bg-[#0A101C] hover:bg-[#111A2C] border border-[#1D2A3D] hover:border-slate-500/40 transition-all flex items-center gap-2.5 cursor-pointer shadow-sm group"
          >
            <div className="w-8 h-8 rounded-xl bg-slate-800/60 border border-slate-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <FolderGit2 className="w-4 h-4 text-white" />
            </div>
            <span className="text-xs sm:text-sm font-semibold text-slate-200 group-hover:text-white truncate">
              GitHub
            </span>
          </button>
        </div>

        {/* ============================================================== */}
        {/* 6. TODAY'S FOCUS SECTION (3 Cards with Progress Bars)          */}
        {/* ============================================================== */}
        <div className="space-y-2.5 pt-1">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2 text-sm font-bold text-white tracking-tight">
              <Target className="w-4 h-4 text-[#00D9FF]" />
              <span>Today's Focus</span>
            </div>
            <Link
              to="/goals"
              className="text-xs text-slate-400 hover:text-[#00D9FF] flex items-center gap-0.5 transition-colors font-medium"
            >
              <span>See all</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-2.5 sm:gap-3 w-full">
            {/* Focus Card 1: DSA Practice */}
            <div
              onClick={() => navigate('/goals')}
              className="p-3 rounded-2xl bg-[#0A101C] border border-[#1D2A3D] hover:border-[#22C55E]/40 transition-all cursor-pointer space-y-2 group shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="w-7 h-7 rounded-lg bg-[#22C55E]/15 border border-[#22C55E]/30 flex items-center justify-center">
                  <Activity className="w-3.5 h-3.5 text-[#22C55E]" />
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-white transition-colors" />
              </div>
              <div>
                <p className="text-xs font-bold text-white truncate">DSA Practice</p>
                <p className="text-[10px] text-slate-400 truncate mt-0.5">2/3 tasks</p>
              </div>
              <div className="w-full h-1 rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full bg-[#22C55E] rounded-full w-[66%]" />
              </div>
            </div>

            {/* Focus Card 2: Life AI Project */}
            <div
              onClick={() => navigate('/goals')}
              className="p-3 rounded-2xl bg-[#0A101C] border border-[#1D2A3D] hover:border-[#00D9FF]/40 transition-all cursor-pointer space-y-2 group shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="w-7 h-7 rounded-lg bg-[#00D9FF]/15 border border-[#00D9FF]/30 flex items-center justify-center">
                  <Code2 className="w-3.5 h-3.5 text-[#00D9FF]" />
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-white transition-colors" />
              </div>
              <div>
                <p className="text-xs font-bold text-white truncate">Life AI Project</p>
                <p className="text-[10px] text-slate-400 truncate mt-0.5">1/2 tasks</p>
              </div>
              <div className="w-full h-1 rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full bg-[#00D9FF] rounded-full w-[50%]" />
              </div>
            </div>

            {/* Focus Card 3: 1 Alarm */}
            <div
              onClick={() => navigate('/alarms')}
              className="p-3 rounded-2xl bg-[#0A101C] border border-[#1D2A3D] hover:border-[#EC4899]/40 transition-all cursor-pointer space-y-2 group shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="w-7 h-7 rounded-lg bg-[#EC4899]/15 border border-[#EC4899]/30 flex items-center justify-center">
                  <AlarmClock className="w-3.5 h-3.5 text-[#EC4899]" />
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-white transition-colors" />
              </div>
              <div>
                <p className="text-xs font-bold text-white truncate">1 Alarm</p>
                <p className="text-[10px] text-slate-400 truncate mt-0.5">{nextAlarmText}</p>
              </div>
              <div className="w-full h-1 rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full bg-[#EC4899] rounded-full w-[100%]" />
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* 7. HERO MAIN VOICE CONTROLLER DOCK                             */}
        {/* ============================================================== */}
        <div className="pt-2 sm:pt-4 flex flex-col items-center justify-center w-full space-y-2">
          <div className="flex items-center justify-center gap-6 sm:gap-10 w-full">
            {/* Keyboard Button (Opens Chat) */}
            <button
              type="button"
              onClick={() => navigate('/chat')}
              className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-[#090E17] hover:bg-[#121B2A] border border-[#1D2A3D] hover:border-[#00D9FF]/40 flex items-center justify-center text-slate-300 hover:text-white transition-all cursor-pointer shadow-lg active:scale-95"
              title="Open Chat keyboard"
            >
              <Keyboard className="w-5 h-5 text-slate-300" />
            </button>

            {/* Large Hero Glowing Microphone Button */}
            <div className="relative flex items-center justify-center">
              {/* Concentric ripple rings */}
              <div className={`absolute -inset-3 sm:-inset-4 rounded-full bg-gradient-to-tr from-[#00D9FF]/30 to-[#8B5CF6]/30 blur-md ${
                voiceState === 'listening' || isVoiceModeEnabled ? 'animate-pulse' : ''
              }`} />
              <div className="absolute -inset-1.5 sm:-inset-2 rounded-full border border-[#00D9FF]/50 shadow-[0_0_25px_rgba(0,217,255,0.4)]" />

              <button
                type="button"
                onClick={() => triggerManualListen()}
                className={`relative z-10 w-16 h-16 sm:w-18 sm:h-18 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-[0_0_30px_rgba(0,217,255,0.6)] ${
                  !isVoiceModeEnabled
                    ? 'bg-slate-800 border-2 border-slate-600 text-slate-400'
                    : 'bg-gradient-to-tr from-[#00A8FF] via-[#00D9FF] to-[#8B5CF6] border-2 border-white/60 text-white'
                }`}
                title={isVoiceModeEnabled ? 'Click to speak or barge-in' : 'Voice is paused - Click to activate'}
              >
                {!isVoiceModeEnabled ? (
                  <MicOff className="w-7 h-7 sm:w-8 sm:h-8 text-slate-400" />
                ) : (
                  <Mic className={`w-7 h-7 sm:w-8 sm:h-8 text-white ${
                    voiceState === 'listening' ? 'scale-110 animate-pulse' : ''
                  }`} />
                )}
              </button>
            </div>

            {/* Voice Settings Tuner Button */}
            <button
              type="button"
              onClick={() => setIsTunerOpen(true)}
              className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-[#090E17] hover:bg-[#121B2A] border border-[#1D2A3D] hover:border-[#00D9FF]/40 flex items-center justify-center text-slate-300 hover:text-white transition-all cursor-pointer shadow-lg active:scale-95"
              title="Voice Settings & Tuner"
            >
              <SlidersHorizontal className="w-5 h-5 text-slate-300" />
            </button>
          </div>

          {/* Say "Hey Life" Audio Wave Ticks Footer */}
          <div className="flex items-center justify-center gap-2 pt-1 text-xs text-slate-300 font-medium">
            <span className="text-[#00D9FF] font-bold text-sm tracking-wider">∿|∿</span>
            <span>Say <strong className="text-white">"{wakeWord}"</strong></span>
            <span className="text-[#00D9FF] font-bold text-sm tracking-wider">∿|∿</span>
          </div>
        </div>

      </div>

      {/* Voice Diagnostics Modal */}
      <VoiceDiagnosticsModal />

      {/* Voice Settings Tuner Modal */}
      {isTunerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="relative w-full max-w-sm rounded-3xl bg-[#0A101C] border border-[#1D2A3D] shadow-2xl p-5 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-[#1D2A3D] pb-3">
              <div className="flex items-center gap-2 font-bold text-white text-sm">
                <SlidersHorizontal className="w-4 h-4 text-[#00D9FF]" />
                <span>Voice Controls & Tuner</span>
              </div>
              <button
                onClick={() => setIsTunerOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs text-slate-200">
              {/* Voice Mode ON/OFF */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-[#0E1624] border border-[#1D2A3D]">
                <div>
                  <p className="font-bold text-white">Voice Mode</p>
                  <p className="text-[10px] text-slate-400">Foreground auto-listening</p>
                </div>
                <button
                  type="button"
                  onClick={toggleVoiceMode}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                    isVoiceModeEnabled
                      ? 'bg-[#22C55E] text-black shadow-[0_0_12px_rgba(34,197,94,0.4)]'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {isVoiceModeEnabled ? 'ON' : 'OFF'}
                </button>
              </div>

              {/* Wake Word Standby */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-[#0E1624] border border-[#1D2A3D]">
                <div>
                  <p className="font-bold text-white">Wake Word ("{wakeWord}")</p>
                  <p className="text-[10px] text-slate-400">Natural voice trigger</p>
                </div>
                <button
                  type="button"
                  onClick={toggleWakeWord}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                    isWakeWordEnabled
                      ? 'bg-[#00D9FF] text-black shadow-[0_0_12px_rgba(0,217,255,0.4)]'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {isWakeWordEnabled ? 'Active' : 'Muted'}
                </button>
              </div>

              {/* Android Deep Sleep Exemption */}
              {isNativePlatform && (
                <div className="p-3 rounded-2xl bg-[#0E1624] border border-[#1D2A3D] space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-white">Battery Optimization</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isBatteryOptimizedExempt ? 'bg-[#22C55E]/15 text-[#22C55E]' : 'bg-amber-500/15 text-amber-300'
                    }`}>
                      {isBatteryOptimizedExempt ? 'Exempt' : 'Restricted'}
                    </span>
                  </div>
                  {!isBatteryOptimizedExempt && (
                    <button
                      type="button"
                      onClick={requestBatteryOptimizationExemption}
                      className="w-full py-2 rounded-xl bg-gradient-to-r from-[#00A8FF] to-[#00D9FF] text-black font-bold text-xs cursor-pointer shadow"
                    >
                      Disable Battery Restriction
                    </button>
                  )}
                </div>
              )}

              {/* Link to diagnostics */}
              <button
                type="button"
                onClick={() => {
                  setIsTunerOpen(false);
                  setIsDiagnosticsOpen(true);
                }}
                className="w-full py-2.5 rounded-2xl bg-[#0E1624] hover:bg-[#162236] border border-[#1D2A3D] text-slate-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <LineChart className="w-3.5 h-3.5 text-[#00D9FF]" />
                <span>Open Audio & Voice Diagnostics</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};