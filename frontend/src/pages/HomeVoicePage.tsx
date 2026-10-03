import React from 'react';
import { useVoice } from '../context/VoiceContext';
import { WakeWordIndicator } from '../components/WakeWordIndicator';
import { VoiceWaveform } from '../components/VoiceWaveform';
import { Sparkles, MessageSquare, ShieldAlert, ArrowRight, Mic } from 'lucide-react';
import { Link } from 'react-router-dom';

export const HomeVoicePage: React.FC = () => {
  const {
    voiceState,
    transcript,
    assistantResponse,
    isWakeWordEnabled,
    micPermissionError,
    toggleWakeWord,
    triggerManualListen,
    requestMicPermission
  } = useVoice();

  const suggestedQuestions = [
    "Aaj maine kya kiya?",
    "What are my skills?",
    "When did I learn ChromaDB?",
    "What is my current focus project?",
    "What did I do yesterday?"
  ];

  return (
    <div className="flex-1 overflow-y-auto w-full p-4 sm:p-6 max-w-4xl mx-auto flex flex-col items-center justify-between pb-24 md:pb-6">
      {/* Mic Permission Warning Banner if blocked */}
      {micPermissionError && (
        <div className="w-full max-w-xl p-3.5 mb-2 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
            <span>
              Microphone access blocked. Click the <strong>microphone icon</strong> in your browser address bar to <strong>Allow</strong>.
            </span>
          </div>
          <button
            onClick={requestMicPermission}
            className="px-3 py-1.5 rounded-xl bg-amber-500 text-black font-bold text-[11px] shrink-0 hover:bg-amber-400"
          >
            Allow Mic
          </button>
        </div>
      )}

      {/* Top Banner */}
      <div className="text-center mt-2 space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/25 text-orange-400 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Alexa-Style Voice Experience Active</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Talk to <span className="text-orange-500">Life</span>
        </h2>
        <p className="text-sm text-gray-400 max-w-md mx-auto">
          Say <span className="text-orange-400 font-semibold">"Life"</span> anytime. She will wake up, greet you, and listen to your daily thoughts and questions.
        </p>
      </div>

      {/* Centerpiece: Glowing Orb Visualizer */}
      <div className="my-6 flex flex-col items-center w-full">
        <WakeWordIndicator
          state={voiceState}
          wakeWordEnabled={isWakeWordEnabled}
          onToggleWakeWord={toggleWakeWord}
          onManualTrigger={triggerManualListen}
        />

        {/* Live Audio Waveform */}
        <div className="mt-4">
          <VoiceWaveform isActive={voiceState === 'listening' || voiceState === 'speaking'} />
        </div>

        {/* Live Speech Feedback Area */}
        <div className="w-full max-w-xl min-h-[100px] mt-6 p-4 rounded-2xl border border-gray-800/80 bg-[#121217]/80 backdrop-blur-md flex flex-col justify-center text-center">
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
              <span className="text-[11px] uppercase tracking-wider font-bold text-orange-400">Life Response</span>
              <p className="text-sm text-gray-200 font-normal leading-relaxed">{assistantResponse}</p>
            </div>
          )}

          {voiceState === 'idle' && (
            <div className="space-y-1">
              <p className="text-xs text-gray-500">Wake word engine is listening in the background.</p>
              <p className="text-xs text-gray-400">
                You can say <span className="text-orange-400 font-semibold">"Life"</span> or tap the button above to talk.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Suggested Questions Grid */}
      <div className="w-full space-y-3 mb-2">
        <div className="flex items-center justify-between text-xs text-gray-400 px-1">
          <span className="font-semibold uppercase tracking-wider text-gray-500">Try asking Life:</span>
          <Link to="/chat" className="text-orange-400 hover:underline flex items-center gap-1">
            Open Full Chat <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {suggestedQuestions.map((q, i) => (
            <button
              key={i}
              onClick={() => {
                triggerManualListen();
              }}
              className="text-left text-xs p-3 rounded-xl border border-gray-800/80 bg-[#14141c] hover:border-orange-500/40 hover:bg-orange-500/5 transition-all text-gray-300 hover:text-orange-200 flex items-center justify-between group"
            >
              <span>"{q}"</span>
              <MessageSquare className="w-3.5 h-3.5 text-gray-600 group-hover:text-orange-400 shrink-0 ml-2" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};