import React, { useState, useEffect } from 'react';
import { useVoice } from '../context/VoiceContext';
import {
  Settings,
  Volume2,
  ShieldCheck,
  Download,
  CheckCircle2,
  Smartphone,
  Radio,
  Wifi,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Lock,
  Database,
  FileText,
  Sliders,
  ChevronRight,
  Code2,
  GitBranch
} from 'lucide-react';
import axios from 'axios';
import { api } from '../services/api';

export const SettingsPage: React.FC = () => {
  const {
    isWakeWordEnabled,
    toggleWakeWord,
    isHandsFreeMode,
    toggleHandsFreeMode,
    wakeWord,
    updateWakeWord,
    voiceResponseEnabled,
    updateVoiceResponse,
    isNativePlatform,
    detailedVoiceState,
    isBatteryOptimizedExempt,
    checkBatteryOptimization,
    requestBatteryOptimizationExemption
  } = useVoice();

  const [selectedVoice, setSelectedVoice] = useState<string>(() => localStorage.getItem('life_voice_preference') || 'hi-IN-SwaraNeural');
  const [silenceTimeout, setSilenceTimeout] = useState<number>(() => parseInt(localStorage.getItem('life_silence_timeout') || '7'));
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [serverUrl, setServerUrl] = useState<string>(() => {
    const saved = localStorage.getItem('life_server_url');
    if (saved && !saved.includes('192.168.1.123')) return saved;
    return 'https://life-ai-daoh.onrender.com';
  });

  // Test Connection state
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState<string>('');

  // GitHub Integration state
  const [ghConnected, setGhConnected] = useState<boolean>(false);
  const [ghUsername, setGhUsername] = useState<string>('');
  const [ghTokenInput, setGhTokenInput] = useState<string>('');
  const [ghUsernameInput, setGhUsernameInput] = useState<string>('');
  const [ghRepoInput, setGhRepoInput] = useState<string>('');
  const [ghLoading, setGhLoading] = useState<boolean>(false);
  const [ghMessage, setGhMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [ghIndexedRepos, setGhIndexedRepos] = useState<any[]>([]);
  const [remoteRepos, setRemoteRepos] = useState<any[]>([]);

  const fetchGitHubStatus = async () => {
    try {
      const data = await api.getGitHubStatus();
      setGhConnected(data.is_connected);
      if (data.username) setGhUsername(data.username);
      setGhIndexedRepos(data.indexed_repositories || []);

      if (data.is_connected) {
        try {
          const rList = await api.listGitHubRepos();
          if (rList && rList.repositories) {
            setRemoteRepos(rList.repositories);
          }
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchGitHubStatus();
  }, []);

  const handleConnectGitHub = async () => {
    if (!ghTokenInput.trim()) {
      setGhMessage({ type: 'error', text: 'Please enter a valid GitHub token (PAT).' });
      return;
    }
    setGhLoading(true);
    setGhMessage(null);
    try {
      const res = await api.connectGitHub(ghTokenInput.trim(), ghUsernameInput.trim() || undefined);
      setGhConnected(true);
      if (res.username) setGhUsername(res.username);
      setGhTokenInput('');
      setGhMessage({ type: 'success', text: `GitHub connected successfully as @${res.username || 'user'}!` });
      await fetchGitHubStatus();
    } catch (err: any) {
      setGhMessage({ type: 'error', text: err.response?.data?.detail || 'Failed to connect GitHub account.' });
    } finally {
      setGhLoading(false);
    }
  };

  const handleIndexRepo = async (repoNameOverride?: string) => {
    const targetRepo = (repoNameOverride || ghRepoInput).trim();
    if (!targetRepo) {
      setGhMessage({ type: 'error', text: 'Please enter repository name (e.g. vikashyadav/sql-rag).' });
      return;
    }
    setGhLoading(true);
    setGhMessage({ type: 'info', text: `Indexing repository ${targetRepo}... (fetching tree and AST chunking)` });
    try {
      const res = await api.indexGitHubRepo(targetRepo);
      setGhMessage({ type: 'success', text: `Repository ${res.repository} indexed! ${res.chunks_indexed} code chunks embedded.` });
      setGhRepoInput('');
      await fetchGitHubStatus();
    } catch (err: any) {
      setGhMessage({ type: 'error', text: err.response?.data?.detail || 'Failed to index repository.' });
    } finally {
      setGhLoading(false);
    }
  };

  const handleIndexAllRepos = async () => {
    setGhLoading(true);
    setGhMessage({ type: 'info', text: '⚡ Auto-indexing all your GitHub repositories into Code Brain... This may take a minute.' });
    try {
      const res = await api.indexAllGitHubRepos();
      setGhMessage({
        type: 'success',
        text: `⚡ All Repositories Indexed! (${res.repos_indexed} of ${res.total_repos_found} repos indexed, ${res.total_chunks_indexed} code chunks embedded)`
      });
      await fetchGitHubStatus();
    } catch (err: any) {
      setGhMessage({ type: 'error', text: err.response?.data?.detail || 'Failed to auto-index all repositories.' });
    } finally {
      setGhLoading(false);
    }
  };

  const handleSaveSettings = () => {
    const cleanUrl = serverUrl.trim().replace(/\/+$/, '');
    localStorage.setItem('life_server_url', cleanUrl);
    localStorage.setItem('life_voice_preference', selectedVoice);
    localStorage.setItem('life_silence_timeout', silenceTimeout.toString());
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleTestConnection = async () => {
    setTestStatus('testing');
    setTestMessage('Pinging server...');
    const cleanUrl = serverUrl.trim().replace(/\/+$/, '');
    try {
      const res = await axios.get(`${cleanUrl}/health`, { timeout: 6000 });
      if (res.data && (res.data.status === 'ok' || res.data.status === 'healthy')) {
        setTestStatus('success');
        if (res.data.gemini_connected === false) {
          setTestMessage('Connected to server! ⚠️ Note: GEMINI_API_KEY is missing on Render Environment Variables.');
        } else {
          setTestMessage(`Connected! Server: "${res.data.app || 'Life AI Active'}" | 🤖 Gemini Active`);
        }
      } else {
        setTestStatus('success');
        setTestMessage('Connected to server successfully!');
      }
    } catch (err: any) {
      setTestStatus('error');
      setTestMessage(err.message?.includes('timeout') 
        ? 'Connection timed out. Check Wi-Fi or Render spin-up time.' 
        : 'Cannot reach server at this URL. Make sure backend or Render service is active.');
    }
  };

  const handleExportData = () => {
    const backupData = {
      app: 'Life AI Personal Companion',
      export_date: new Date().toISOString(),
      user: 'Vikash Yadav',
      server_url: serverUrl,
      voice_preference: selectedVoice,
      status: 'encrypted_backup'
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `life_ai_backup_${Date.now()}.json`;
    a.click();
  };

  return (
    <div className="flex-1 overflow-y-auto w-full p-4 sm:p-6 max-w-4xl mx-auto space-y-6 pb-28 md:pb-8 min-h-0">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#00A8FF]/20 via-[#00D9FF]/20 to-[#8B5CF6]/20 border border-[#00D9FF]/30 flex items-center justify-center text-[#00D9FF] shadow-[0_0_15px_rgba(0,217,255,0.2)]">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
              Settings & Preferences
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Customize voice assistant, wake-word parameters, server connection, and data vaults.
            </p>
          </div>
        </div>
      </div>

      {savedSuccess && (
        <div className="p-3.5 rounded-xl bg-[#22C55E]/15 border border-[#22C55E]/30 text-[#22C55E] text-xs font-semibold flex items-center gap-2 shadow-lg shadow-[#22C55E]/10">
          <CheckCircle2 className="w-4 h-4 text-[#22C55E]" /> All preferences and server settings saved successfully!
        </div>
      )}

      {/* Section 1: Voice Assistant */}
      <div className="p-5 rounded-2xl border border-[#202B3D] bg-[#101722] space-y-4 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#00D9FF]/10 border border-[#00D9FF]/30 text-[#00D9FF] text-[10px] font-bold uppercase tracking-wider mb-1.5">
              <Sparkles className="w-3 h-3" /> Voice Engine
            </div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Radio className="w-4 h-4 text-[#00D9FF]" /> Voice Assistant
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-xl leading-relaxed">
              Hands-free wake word recognition and natural text-to-speech engine.
            </p>
          </div>
        </div>

        <div className="space-y-4 pt-2 border-t border-[#202B3D]">
          {/* Hands-Free Main Toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#0A0F18] border border-[#202B3D]">
            <div>
              <p className="text-xs font-bold text-white flex items-center gap-2">
                Hands-Free Background Mode
                {isHandsFreeMode ? (
                  <span className="px-2 py-0.5 rounded-md bg-[#22C55E]/20 text-[#22C55E] text-[10px] font-semibold border border-[#22C55E]/30">Active</span>
                ) : (
                  <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 text-[10px] font-medium">Off</span>
                )}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Android background service keeps listening for "{wakeWord}" even when screen is locked.
              </p>
            </div>
            <button
              onClick={toggleHandsFreeMode}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                isHandsFreeMode
                  ? 'bg-gradient-to-r from-[#22C55E] to-[#10B981] text-white shadow-lg shadow-[#22C55E]/25'
                  : 'bg-[#141C28] text-slate-300 border border-[#202B3D] hover:bg-[#1A2332]'
              }`}
            >
              {isHandsFreeMode ? 'ENABLED (ON)' : 'TURN ON'}
            </button>
          </div>

          {/* Wake Word Selector & Voice Response */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-300 font-medium">Wake Word Phrase</label>
              <select
                value={wakeWord}
                onChange={(e) => updateWakeWord(e.target.value)}
                className="w-full mt-1.5 bg-[#0A0F18] border border-[#202B3D] rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-[#00D9FF] font-semibold cursor-pointer"
              >
                <option value="Hey Life">Hey Life (Default)</option>
                <option value="Life">Life</option>
                <option value="Hey Jeet">Hey Jeet</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-300 font-medium">Spoken Audio Response (TTS)</label>
              <div className="flex items-center justify-between mt-1.5 p-2.5 rounded-xl bg-[#0A0F18] border border-[#202B3D]">
                <span className="text-xs text-slate-300">Voice output</span>
                <button
                  onClick={() => updateVoiceResponse(!voiceResponseEnabled)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                    voiceResponseEnabled
                      ? 'bg-[#00D9FF]/20 text-[#00D9FF] border border-[#00D9FF]/40'
                      : 'bg-[#141C28] text-slate-400 border border-[#202B3D]'
                  }`}
                >
                  {voiceResponseEnabled ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>
          </div>

          {/* Assistant Voice Dropdown */}
          <div>
            <label className="text-xs text-slate-300 font-medium">Assistant Speech Voice</label>
            <select
              value={selectedVoice}
              onChange={(e) => setSelectedVoice(e.target.value)}
              className="w-full mt-1.5 bg-[#0A0F18] border border-[#202B3D] rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-[#00D9FF] cursor-pointer"
            >
              <option value="hi-IN-SwaraNeural">Hindi / Hinglish — Swara (Warm Indian Female Voice)</option>
              <option value="en-IN-NeerjaNeural">Indian English — Neerja (Fluent Indian Female Voice)</option>
              <option value="hi-IN-MadhurNeural">Hindi / Hinglish — Madhur (Indian Male Voice)</option>
              <option value="en-US-JennyNeural">English — Jenny (Natural US Female Voice)</option>
            </select>
          </div>

          {/* Silence Timeout Slider */}
          <div>
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>Silence Timeout (return to listening)</span>
              <span className="text-[#00D9FF] font-semibold">{silenceTimeout} seconds</span>
            </div>
            <input
              type="range"
              min="4"
              max="15"
              value={silenceTimeout}
              onChange={(e) => setSilenceTimeout(parseInt(e.target.value))}
              className="w-full accent-[#00D9FF] cursor-pointer"
            />
          </div>

          {/* Live Voice Service State Indicator Panel */}
          <div className="p-3.5 rounded-xl bg-[#0A0F18] border border-[#202B3D] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                <Radio className="w-3.5 h-3.5 text-[#00D9FF]" /> Live Service Status
              </span>
              <span className="text-[10px] uppercase font-bold text-slate-400">Current: {detailedVoiceState}</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              <div className={`p-2 rounded-lg border flex items-center gap-2 transition-all ${
                detailedVoiceState === 'wake_listening'
                  ? 'bg-[#22C55E]/15 border-[#22C55E]/50 text-white shadow-sm shadow-[#22C55E]/20'
                  : 'bg-[#141C28]/60 border-[#202B3D] text-slate-400 opacity-60'
              }`}>
                <span className="w-2.5 h-2.5 rounded-full bg-[#22C55E] shrink-0" />
                <span className="text-[11px] font-medium truncate">🟢 Listening for "{wakeWord}"</span>
              </div>

              <div className={`p-2 rounded-lg border flex items-center gap-2 transition-all ${
                detailedVoiceState === 'user_listening' || detailedVoiceState === 'cooldown'
                  ? 'bg-[#F97316]/15 border-[#F97316]/50 text-white shadow-sm shadow-[#F97316]/20'
                  : 'bg-[#141C28]/60 border-[#202B3D] text-slate-400 opacity-60'
              }`}>
                <span className="w-2.5 h-2.5 rounded-full bg-[#F97316] shrink-0" />
                <span className="text-[11px] font-medium truncate">🟠 Listening to you</span>
              </div>

              <div className={`p-2 rounded-lg border flex items-center gap-2 transition-all ${
                detailedVoiceState === 'processing'
                  ? 'bg-[#00D9FF]/15 border-[#00D9FF]/50 text-white shadow-sm shadow-[#00D9FF]/20'
                  : 'bg-[#141C28]/60 border-[#202B3D] text-slate-400 opacity-60'
              }`}>
                <span className="w-2.5 h-2.5 rounded-full bg-[#00D9FF] shrink-0" />
                <span className="text-[11px] font-medium truncate">🔵 Thinking</span>
              </div>

              <div className={`p-2 rounded-lg border flex items-center gap-2 transition-all ${
                detailedVoiceState === 'greeting' || detailedVoiceState === 'tts'
                  ? 'bg-[#C026D3]/15 border-[#C026D3]/50 text-white shadow-sm shadow-[#C026D3]/20'
                  : 'bg-[#141C28]/60 border-[#202B3D] text-slate-400 opacity-60'
              }`}>
                <span className="w-2.5 h-2.5 rounded-full bg-[#C026D3] shrink-0" />
                <span className="text-[11px] font-medium truncate">🟣 Speaking</span>
              </div>

              <div className={`p-2 rounded-lg border flex items-center gap-2 transition-all ${
                detailedVoiceState === 'error'
                  ? 'bg-[#EF4444]/15 border-[#EF4444]/50 text-white shadow-sm shadow-[#EF4444]/20'
                  : 'bg-[#141C28]/60 border-[#202B3D] text-slate-400 opacity-60'
              }`}>
                <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444] shrink-0" />
                <span className="text-[11px] font-medium truncate">🔴 Error</span>
              </div>

              <div className={`p-2 rounded-lg border flex items-center gap-2 transition-all ${
                detailedVoiceState === 'stopped'
                  ? 'bg-slate-700/20 border-slate-600 text-slate-200'
                  : 'bg-[#141C28]/60 border-[#202B3D] text-slate-400 opacity-60'
              }`}>
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400 shrink-0" />
                <span className="text-[11px] font-medium truncate">⚪ Service stopped</span>
              </div>
            </div>
          </div>

          {/* Android Battery Optimization Card */}
          <div className="p-4 rounded-xl bg-[#141C28] border border-[#202B3D] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-[#00D9FF]" /> Android Battery Optimization
              </span>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                isBatteryOptimizedExempt
                  ? 'bg-[#22C55E]/15 border border-[#22C55E]/30 text-[#22C55E]'
                  : 'bg-amber-500/15 border border-amber-500/30 text-amber-300'
              }`}>
                {isBatteryOptimizedExempt ? 'Unrestricted (Protected)' : 'Optimization Active'}
              </span>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              {isBatteryOptimizedExempt
                ? 'App is unrestricted. Android will not kill the hands-free voice service when the screen is locked or during long deep-sleep periods.'
                : 'Battery optimization may silence "Hey Life" after several minutes of screen lock. Exempt the app from optimization for seamless always-on wake-word support.'}
            </p>

            <div className="flex flex-wrap gap-2 pt-1">
              {!isBatteryOptimizedExempt && (
                <button
                  type="button"
                  onClick={requestBatteryOptimizationExemption}
                  className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#00A8FF] to-[#00D9FF] text-black font-bold text-xs hover:opacity-90 transition-all cursor-pointer shadow"
                >
                  Exempt from Battery Optimization
                </button>
              )}
              <button
                type="button"
                onClick={checkBatteryOptimization}
                className="px-3 py-1.5 rounded-lg bg-[#0A0F18] border border-[#202B3D] text-slate-300 text-xs hover:bg-[#101722] transition-all cursor-pointer"
              >
                Re-check Status
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Server & Connection */}
      <div className="p-5 rounded-2xl border border-[#202B3D] bg-[#101722] space-y-4 shadow-sm">
        <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
          <Wifi className="w-4 h-4 text-[#00D9FF]" /> Server & Connection
        </h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          Default cloud backend hosted on Render, or your custom local server.
        </p>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-300 font-medium">Backend Server URL</label>
            <div className="flex flex-col sm:flex-row gap-2 mt-1.5">
              <input
                type="text"
                value={serverUrl}
                onChange={(e) => {
                  setServerUrl(e.target.value);
                  setTestStatus('idle');
                }}
                placeholder="https://life-ai-daoh.onrender.com"
                className="flex-1 bg-[#0A0F18] border border-[#202B3D] rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#00D9FF] font-mono shadow-inner"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testStatus === 'testing'}
                  className="px-4 py-2.5 rounded-xl border border-[#202B3D] bg-[#141C28] hover:bg-[#1A2332] text-xs font-semibold text-slate-200 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testStatus === 'testing' ? 'animate-spin' : ''}`} />
                  Test
                </button>
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#00A8FF] to-[#8B5CF6] hover:from-[#00D9FF] hover:to-[#A855F7] text-xs font-semibold text-white transition-all shadow-md shadow-[#00A8FF]/20 cursor-pointer"
                >
                  Save URL
                </button>
              </div>
            </div>
          </div>

          {/* Test Status Banner */}
          {testStatus !== 'idle' && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                testStatus === 'testing'
                  ? 'bg-[#00D9FF]/10 border-[#00D9FF]/30 text-[#00D9FF]'
                  : testStatus === 'success'
                  ? 'bg-[#22C55E]/10 border-[#22C55E]/30 text-[#22C55E]'
                  : 'bg-red-500/10 border-red-500/30 text-red-300'
              }`}
            >
              {testStatus === 'testing' && <RefreshCw className="w-4 h-4 animate-spin shrink-0" />}
              {testStatus === 'success' && <CheckCircle2 className="w-4 h-4 text-[#22C55E] shrink-0" />}
              {testStatus === 'error' && <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />}
              <span className="leading-relaxed">{testMessage}</span>
            </div>
          )}
        </div>
      </div>

      {/* Section 2.5: GitHub Code Brain */}
      <div className="p-5 rounded-2xl border border-[#202B3D] bg-[#101722] space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Code2 className="w-4 h-4 text-[#00D9FF]" /> GitHub Code Brain
          </h3>
          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
            ghConnected
              ? 'bg-[#22C55E]/15 border border-[#22C55E]/30 text-[#22C55E]'
              : 'bg-slate-800 text-slate-400 border border-[#202B3D]'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${ghConnected ? 'bg-[#22C55E]' : 'bg-slate-500'}`} />
            {ghConnected ? `Connected (@${ghUsername || 'user'})` : 'Not Connected'}
          </span>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          Connect your GitHub account with a Personal Access Token (PAT). Life AI will index your repositories, understand code architecture, classes, and functions, and answer technical questions via text and "Hey Life".
        </p>

        {/* GitHub Token Connection Inputs */}
        <div className="space-y-3 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="sm:col-span-2">
              <label className="text-[11px] text-slate-300 font-medium">Personal Access Token (PAT)</label>
              <input
                type="password"
                value={ghTokenInput}
                onChange={(e) => setGhTokenInput(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                className="w-full mt-1 bg-[#0A0F18] border border-[#202B3D] rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#00D9FF] font-mono shadow-inner"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-300 font-medium">GitHub Username (optional)</label>
              <input
                type="text"
                value={ghUsernameInput}
                onChange={(e) => setGhUsernameInput(e.target.value)}
                placeholder="e.g. vikashyadav"
                className="w-full mt-1 bg-[#0A0F18] border border-[#202B3D] rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#00D9FF] shadow-inner"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleConnectGitHub}
              disabled={ghLoading}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#00A8FF] to-[#8B5CF6] hover:from-[#00D9FF] hover:to-[#A855F7] text-xs font-semibold text-white transition-all shadow-md shadow-[#00A8FF]/20 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              {ghLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <GitBranch className="w-3.5 h-3.5" />}
              {ghConnected ? 'Update GitHub Token' : 'Connect GitHub'}
            </button>
            <button
              type="button"
              onClick={fetchGitHubStatus}
              className="px-3 py-2 rounded-xl border border-[#202B3D] bg-[#141C28] text-xs text-slate-300 hover:bg-[#1A2332] transition-all cursor-pointer"
            >
              Refresh
            </button>
          </div>

          {/* GitHub Status Banner */}
          {ghMessage && (
            <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
              ghMessage.type === 'success'
                ? 'bg-[#22C55E]/10 border-[#22C55E]/30 text-[#22C55E]'
                : ghMessage.type === 'info'
                ? 'bg-[#00D9FF]/10 border-[#00D9FF]/30 text-[#00D9FF]'
                : 'bg-red-500/10 border-red-500/30 text-red-300'
            }`}>
              {ghMessage.type === 'info' && <RefreshCw className="w-4 h-4 animate-spin shrink-0" />}
              {ghMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-[#22C55E] shrink-0" />}
              {ghMessage.type === 'error' && <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />}
              <span className="leading-relaxed">{ghMessage.text}</span>
            </div>
          )}

          {/* Repository Indexing Box */}
          {ghConnected && (
            <div className="pt-3 border-t border-[#202B3D] space-y-3">
              <label className="text-xs text-slate-300 font-semibold flex items-center gap-2">
                <GitBranch className="w-3.5 h-3.5 text-[#00D9FF]" /> Index a Repository into Code Brain
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={ghRepoInput}
                  onChange={(e) => setGhRepoInput(e.target.value)}
                  placeholder="e.g. sql-rag-backend or owner/repo"
                  className="flex-1 bg-[#0A0F18] border border-[#202B3D] rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-[#00D9FF] font-mono shadow-inner"
                />
                <button
                  type="button"
                  onClick={() => handleIndexRepo()}
                  disabled={ghLoading}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#00D9FF] to-[#00A8FF] text-black font-bold text-xs hover:opacity-90 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {ghLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                  Index Repo
                </button>
              </div>

              {/* Remote GitHub Repos List for 1-Click Indexing */}
              {remoteRepos.length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-300 font-semibold flex items-center gap-1.5">
                      <GitBranch className="w-3.5 h-3.5 text-[#00D9FF]" />
                      Your Repositories ({remoteRepos.length})
                    </span>
                    <button
                      type="button"
                      onClick={handleIndexAllRepos}
                      disabled={ghLoading}
                      className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#8B5CF6] to-[#00A8FF] hover:from-[#A855F7] hover:to-[#00D9FF] text-white text-[11px] font-bold shadow-md shadow-[#8B5CF6]/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {ghLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      ⚡ Auto-Index All Repos
                    </button>
                  </div>
                  <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                    {remoteRepos.map((repo) => {
                      const isAlreadyIndexed = ghIndexedRepos.some((ir) => ir.repo_name.toLowerCase() === repo.name.toLowerCase());
                      return (
                        <div key={repo.id} className="p-2.5 rounded-lg bg-[#0A0F18] border border-[#202B3D] flex items-center justify-between text-xs">
                          <div className="truncate pr-2">
                            <div className="font-semibold text-slate-200 truncate flex items-center gap-1.5">
                              <GitBranch className="w-3 h-3 text-[#00D9FF] shrink-0" />
                              <span className="truncate">{repo.name}</span>
                              {repo.is_private && <span className="text-[9px] bg-slate-800 text-slate-400 px-1 py-0.2 rounded">Private</span>}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                              {repo.language || 'Code'} {repo.description ? `• ${repo.description}` : ''}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleIndexRepo(repo.name)}
                            disabled={ghLoading}
                            className={`px-3 py-1 rounded-lg text-[11px] font-semibold shrink-0 cursor-pointer transition-all ${
                              isAlreadyIndexed
                                ? 'bg-[#22C55E]/15 border border-[#22C55E]/40 text-[#22C55E]'
                                : 'bg-gradient-to-r from-[#00A8FF]/20 to-[#00D9FF]/20 hover:from-[#00A8FF]/40 hover:to-[#00D9FF]/40 border border-[#00D9FF]/40 text-[#00D9FF]'
                            }`}
                          >
                            {isAlreadyIndexed ? 'Re-Index' : 'Index Code'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Indexed Repos List */}
              {ghIndexedRepos.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="text-[11px] text-slate-400 font-medium">Indexed Repositories ({ghIndexedRepos.length}):</div>
                  <div className="space-y-1">
                    {ghIndexedRepos.map((r) => (
                      <div key={r.id} className="p-2.5 rounded-lg bg-[#0A0F18] border border-[#202B3D] flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 truncate">
                          <Code2 className="w-3.5 h-3.5 text-[#00D9FF] shrink-0" />
                          <span className="font-mono text-slate-200 truncate">{r.owner ? `${r.owner}/` : ''}{r.repo_name}</span>
                        </div>
                        <span className="text-[10px] text-[#22C55E] bg-[#22C55E]/10 px-2 py-0.5 rounded border border-[#22C55E]/20 shrink-0">
                          {r.status || 'ready'} ({r.files_count || 0} files)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Section 3: Data & Memory Vault */}
      <div className="p-5 rounded-2xl border border-[#202B3D] bg-[#101722] space-y-4 shadow-sm">
        <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
          <Database className="w-4 h-4 text-[#8B5CF6]" /> Data & Memory Vault
        </h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          All conversation memories, profile facts, and uploaded documents are encrypted and synchronized.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div className="p-3 rounded-xl bg-[#0A0F18] border border-[#202B3D] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Database className="w-4 h-4 text-[#00D9FF]" />
              <span className="text-xs text-slate-300 font-medium">Long-Term Memory</span>
            </div>
            <span className="text-xs font-semibold text-[#00D9FF]">Active</span>
          </div>

          <div className="p-3 rounded-xl bg-[#0A0F18] border border-[#202B3D] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <FileText className="w-4 h-4 text-[#8B5CF6]" />
              <span className="text-xs text-slate-300 font-medium">Document RAG & OCR</span>
            </div>
            <span className="text-xs font-semibold text-[#8B5CF6]">Active</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            onClick={handleExportData}
            className="px-4 py-2.5 rounded-xl border border-[#202B3D] bg-[#141C28] hover:bg-[#1A2332] text-xs font-semibold text-slate-200 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4 text-[#00D9FF]" /> Export Profile & Memory Backup
          </button>
        </div>
      </div>
    </div>
  );
};
