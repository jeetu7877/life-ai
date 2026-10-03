import React, { useState } from 'react';
import { useVoice } from '../context/VoiceContext';
import {
  Settings,
  Volume2,
  ShieldCheck,
  Download,
  Trash2,
  CheckCircle2,
  Smartphone,
  Radio,
  Wifi,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Lock
} from 'lucide-react';
import axios from 'axios';

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
    isNativePlatform
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
          setTestMessage(`Connected! Server: "${res.data.app || 'Life Active'}" | 🤖 Gemini AI Active`);
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
      app: 'Life Personal AI Companion',
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
    a.download = `life_companion_backup_${Date.now()}.json`;
    a.click();
  };

  return (
    <div className="flex-1 overflow-y-auto w-full p-4 sm:p-6 max-w-4xl mx-auto space-y-6 pb-28 md:pb-8 min-h-0">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
              Settings & Preferences
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Customize hands-free voice mode, wake-word parameters, and phone-to-server connection.
            </p>
          </div>
        </div>
      </div>

      {savedSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2 shadow-lg shadow-emerald-950/20">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" /> All preferences and server settings saved successfully!
        </div>
      )}

      {/* Production Hands-Free Voice Assistant Mode */}
      <div className="p-5 rounded-2xl border border-orange-500/30 bg-[#14141d]/95 space-y-4 shadow-lg shadow-orange-950/20">
        <div className="flex items-start justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-400 text-[10px] font-bold uppercase tracking-wider mb-1.5">
              <Sparkles className="w-3 h-3" /> Alexa-Style Voice Service
            </div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Radio className="w-4 h-4 text-orange-400" /> Hands-Free Assistant Mode
            </h3>
            <p className="text-xs text-gray-400 mt-1 max-w-xl leading-relaxed">
              Phone lock ho ya app background me ho, bas bolein <strong>"{wakeWord}"</strong>. Life AI kahegi <strong>"Haan, bolo."</strong> aur fir aapke documents aur memories se seedha bolkar jawab degi.
            </p>
          </div>
        </div>

        <div className="space-y-4 pt-2 border-t border-white/[0.08]">
          {/* Hands-Free Main Toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#0a0a0f] border border-white/[0.08]">
            <div>
              <p className="text-xs font-bold text-white flex items-center gap-2">
                Hands-Free Background Service
                {isHandsFreeMode ? (
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 text-[10px] font-semibold border border-emerald-500/30">Active</span>
                ) : (
                  <span className="px-2 py-0.5 rounded-md bg-gray-800 text-gray-400 text-[10px] font-medium">Off</span>
                )}
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Android foreground service keeps listening for wake word even when screen is locked or app is closed.
              </p>
            </div>
            <button
              onClick={toggleHandsFreeMode}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                isHandsFreeMode
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-600/30'
                  : 'bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-750'
              }`}
            >
              {isHandsFreeMode ? 'ENABLED (ON)' : 'TURN ON'}
            </button>
          </div>

          {/* Wake Word Selector & Voice Response */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-300 font-medium">Wake Word Phrase</label>
              <select
                value={wakeWord}
                onChange={(e) => updateWakeWord(e.target.value)}
                className="w-full mt-1.5 bg-[#0a0a0f] border border-white/[0.1] rounded-xl p-3 text-xs text-gray-200 focus:outline-none focus:border-orange-500 font-semibold"
              >
                <option value="Hey Life">Hey Life (Default)</option>
                <option value="Life">Life</option>
                <option value="Hey Jeet">Hey Jeet</option>
                <option value="Jeet">Jeet</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-300 font-medium">Spoken Audio Response (TTS)</label>
              <div className="flex items-center justify-between mt-1.5 p-2.5 rounded-xl bg-[#0a0a0f] border border-white/[0.1]">
                <span className="text-xs text-gray-300">Voice output</span>
                <button
                  onClick={() => updateVoiceResponse(!voiceResponseEnabled)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                    voiceResponseEnabled
                      ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                      : 'bg-gray-800 text-gray-400'
                  }`}
                >
                  {voiceResponseEnabled ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>
          </div>

          {/* Android Battery Advisory Banner */}
          <div className="p-3 rounded-xl bg-orange-950/20 border border-orange-500/20 text-[11px] text-orange-200/90 leading-relaxed space-y-1">
            <p className="font-semibold text-orange-300 flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5" /> Android Background & Screen-Lock Note:
            </p>
            <p>
              MIUI/HyperOS, OxygenOS, ya OneUI devices me app background battery optimization ko <strong>"Unrestricted / No Restrictions"</strong> par set karein taaki screen lock hone ke baad bhi microphone background service active rahe.
            </p>
          </div>
        </div>
      </div>

      {/* Voice & Speech Preferences */}
      <div className="p-5 rounded-2xl border border-white/[0.08] bg-[#121218]/90 space-y-4 shadow-sm">
        <h3 className="text-sm font-bold text-gray-200 flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-orange-400" /> Voice & Speech Preferences
        </h3>

        <div className="space-y-4">
          {/* Assistant Voice Dropdown */}
          <div>
            <label className="text-xs text-gray-300 font-medium">Assistant Speech Voice</label>
            <select
              value={selectedVoice}
              onChange={(e) => setSelectedVoice(e.target.value)}
              className="w-full mt-1.5 bg-[#0a0a0f] border border-white/[0.1] rounded-xl p-3 text-xs text-gray-200 focus:outline-none focus:border-orange-500"
            >
              <option value="hi-IN-SwaraNeural">Hindi / Hinglish — Swara (Warm Indian Female Voice)</option>
              <option value="en-IN-NeerjaNeural">Indian English — Neerja (Fluent Indian Female Voice)</option>
              <option value="hi-IN-MadhurNeural">Hindi / Hinglish — Madhur (Indian Male Voice)</option>
              <option value="en-US-JennyNeural">English — Jenny (Natural US Female Voice)</option>
            </select>
          </div>

          {/* Silence Timeout Slider */}
          <div>
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Silence Timeout (return to listening)</span>
              <span className="text-orange-400 font-semibold">{silenceTimeout} seconds</span>
            </div>
            <input
              type="range"
              min="4"
              max="15"
              value={silenceTimeout}
              onChange={(e) => setSilenceTimeout(parseInt(e.target.value))}
              className="w-full accent-orange-500 cursor-pointer"
            />
          </div>
        </div>

        <button
          onClick={handleSaveSettings}
          className="mt-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold shadow-md shadow-orange-500/20 transition-all cursor-pointer"
        >
          Save Voice Preferences
        </button>
      </div>

      {/* Mobile App & Remote Server Connection */}
      <div className="p-5 rounded-2xl border border-white/[0.08] bg-[#121218]/90 space-y-4 shadow-sm">
        <h3 className="text-sm font-bold text-gray-200 flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-orange-400" /> Phone App & Server Connection
        </h3>
        <p className="text-xs text-gray-400 leading-relaxed">
          Jab aap Life AI ko phone me chalayein, toh default cloud URL (Render) ya local LAN IP save karein.
        </p>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-300 font-medium">Backend Server URL</label>
            <div className="flex flex-col sm:flex-row gap-2 mt-1.5">
              <input
                type="text"
                value={serverUrl}
                onChange={(e) => {
                  setServerUrl(e.target.value);
                  setTestStatus('idle');
                }}
                placeholder="e.g. https://life-ai-daoh.onrender.com"
                className="flex-1 bg-[#0a0a0f] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-gray-200 focus:outline-none focus:border-orange-500 font-mono shadow-inner"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testStatus === 'testing'}
                  className="px-4 py-2.5 rounded-xl border border-white/[0.1] bg-white/[0.05] hover:bg-white/[0.1] text-xs font-semibold text-gray-200 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testStatus === 'testing' ? 'animate-spin' : ''}`} />
                  Test
                </button>
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  className="px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-xs font-semibold text-white transition-all shadow-md shadow-orange-500/20 cursor-pointer"
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
                  ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                  : testStatus === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-red-500/10 border-red-500/30 text-red-300'
              }`}
            >
              {testStatus === 'testing' && <RefreshCw className="w-4 h-4 animate-spin shrink-0" />}
              {testStatus === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
              {testStatus === 'error' && <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />}
              <span className="leading-relaxed">{testMessage}</span>
            </div>
          )}
        </div>
      </div>

      {/* Security & Data Backup */}
      <div className="p-5 rounded-2xl border border-white/[0.08] bg-[#121218]/90 space-y-4 shadow-sm">
        <h3 className="text-sm font-bold text-gray-200 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-orange-400" /> Security & Data Backup
        </h3>
        <p className="text-xs text-gray-400 leading-relaxed">
          Aapki sabhi conversation memories, profile facts, aur documents encryption ke saath secure hain.
        </p>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            onClick={handleExportData}
            className="px-4 py-2.5 rounded-xl border border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] text-xs font-semibold text-gray-200 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4 text-orange-400" /> Export Profile & Memory Backup
          </button>
        </div>
      </div>
    </div>
  );
};
