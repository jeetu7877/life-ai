import React from 'react';
import { useVoice } from '../context/VoiceContext';
import { WakeWordIndicator } from '../components/WakeWordIndicator';
import { VoiceWaveform } from '../components/VoiceWaveform';
import { Sparkles, MessageSquare, ShieldAlert, ArrowRight, Mic, Radio, Smartphone, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';

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

  const suggestedQuestions = [
    "Mera roll number kya hai?",
    "What is my college?",
    "Meri bestie ka naam kya hai?",
    "What are my DBMS marks in semester 5?",
    "Give me all details from my college ID."
  ];

  return (
    <div className="flex-1 overflow-y-auto w-full p-4 sm:p-6 max-w-4xl mx-auto flex flex-col items-center justify-between pb-24 md:pb-6">
      {/* Mic Permission Warning Banner if blocked */}
      {micPermissionError && (
        <div className="w-full max-w-xl p-3.5 mb-2 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs flex items-center justify-between gap-3 shadow-lg">
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

      {/* Top Banner */}
      <div className="text-center mt-2 space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/25 text-orange-400 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Hands-Free Alexa-Style Voice Assistant</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Talk to <span className="text-orange-500">Life AI</span>
        </h2>
        <p className="text-sm text-gray-400 max-w-md mx-auto">
          Say <span className="text-orange-400 font-semibold">"{wakeWord}"</span> anytime — even when your phone is locked or app is in background.
        </p>
      </div>

      {/* Centerpiece: Glowing Orb Visualizer */}
      <div className="my-6 flex flex-col items-center w-full">
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
        <div className="mt-4">
          <VoiceWaveform isActive={voiceState === 'listening' || voiceState === 'speaking'} />
        </div>

        {/* Live Speech Feedback Area */}
        <div className="w-full max-w-xl min-h-[100px] mt-6 p-4 rounded-2xl border border-gray-800/80 bg-[#121217]/80 backdrop-blur-md flex flex-col justify-center text-center shadow-lg">
          {voiceState === 'listening' && (
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-orange-400">Live Speech Input</span>
              <p className="text-base text-orange-100 font-medium italic">
                "{transcript || 'Speak now, Life is listening...'}"
              </p>
            </div>
          )}

          {voiceState === 'thinking' && (
            <div className="flex items-center justify-center gap-2 text-amber-300 text-sm font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              Searching memory & documents...
            </div>
          )}

          {voiceState === 'speaking' && (
            <div className="space-y-1">
              <span className="text-[11px] uppercase tracking-wider font-bold text-orange-400">Life AI Response</span>
              <p className="text-sm text-gray-200 font-normal leading-relaxed">{assistantResponse}</p>
            </div>
          )}

          {voiceState === 'idle' && (
            <div className="space-y-1">
              <p className="text-xs text-gray-400">
                {isHandsFreeMode ? (
                  <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
                    <Lock className="w-3.5 h-3.5" /> Hands-free background active: Say "{wakeWord}" to ask
                  </span>
                ) : (
                  <span>Say <strong>"{wakeWord}"</strong> or tap the orb above to speak</span>
                )}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Suggested Questions Section */}
      <div className="w-full max-w-xl space-y-3">
        <div className="flex items-center justify-between text-xs text-gray-400 px-1">
          <span className="font-semibold uppercase tracking-wider text-[11px]">Suggested Voice Inquiries</span>
          <Link to="/chat" className="text-orange-400 hover:text-orange-300 flex items-center gap-1 font-medium">
            Open Full Chat <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="flex flex-wrap gap-2 justify-center">
          {suggestedQuestions.map((q, idx) => (
            <button
              key={idx}
              onClick={() => {
                triggerManualListen();
              }}
              className="text-xs px-3.5 py-2 rounded-xl border border-white/[0.08] bg-[#14141c]/90 text-gray-300 hover:border-orange-500/40 hover:text-orange-300 hover:bg-[#1a1a24] transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Mic className="w-3 h-3 text-orange-400/80" />
              <span>{q}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};