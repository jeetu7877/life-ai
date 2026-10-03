import React, { useState, useEffect } from 'react';
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
  Sparkles
} from 'lucide-react';
import axios from 'axios';

export const SettingsPage: React.FC = () => {
  const { isWakeWordEnabled, toggleWakeWord } = useVoice();
  const [selectedVoice, setSelectedVoice] = useState<string>(() => localStorage.getItem('life_voice_preference') || 'hi-IN-SwaraNeural');
  const [silenceTimeout, setSilenceTimeout] = useState<number>(() => parseInt(localStorage.getItem('life_silence_timeout') || '7'));
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [serverUrl, setServerUrl] = useState<string>(() => {
    const saved = localStorage.getItem('life_server_url');
    if (saved && !saved.includes('192.168.1.123')) return saved;
    return 'http://10.10.202.55:8000';
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
      const res = await axios.get(`${cleanUrl}/health`, { timeout: 5000 });
      if (res.data && res.data.status === 'ok') {
        setTestStatus('success');
        setTestMessage(`Connected! Server responded: "${res.data.app || 'Life Active'}"`);
      } else {
        setTestStatus('success');
        setTestMessage('Connected to server successfully!');
      }
    } catch (err: any) {
      setTestStatus('error');
      setTestMessage(err.message?.includes('timeout') 
        ? 'Connection timed out. Check Wi-Fi or Hotspot.' 
        : 'Cannot reach server at this URL. Make sure backend is running.');
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
              Customize voice parameters, wake-word sensitivity, and phone-to-server connection.
            </p>
          </div>
        </div>
      </div>

      {savedSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2 shadow-lg shadow-emerald-950/20">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" /> All preferences and server settings saved successfully!
        </div>
      )}

      {/* Voice & Wake Word Settings */}
      <div className="p-5 rounded-2xl border border-white/[0.08] bg-[#121218]/90 space-y-4 shadow-sm">
        <h3 className="text-sm font-bold text-gray-200 flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-orange-400" /> Voice & Wake Word Experience
        </h3>

        <div className="space-y-4">
          {/* Wake Word Toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-[#0a0a0f] border border-white/[0.06]">
            <div>
              <p className="text-xs font-semibold text-white">Wake Word "Life"</p>
              <p className="text-[11px] text-gray-400">Continuously listen for "Life" / "लाइफ" to wake up assistant.</p>
            </div>
            <button
              onClick={toggleWakeWord}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                isWakeWordEnabled
                  ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-md shadow-orange-600/20'
                  : 'bg-gray-800 text-gray-400 border border-gray-700'
              }`}
            >
              {isWakeWordEnabled ? 'Active' : 'Muted'}
            </button>
          </div>

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
          Jab aap Life AI ko phone me (APK ya Chrome) chalayein, toh laptop ka Wi-Fi IP ya Cloud URL yahan save karein taaki phone seedha backend se jud sake.
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
                placeholder="e.g. http://10.10.202.55:8000 or https://your-app.onrender.com"
                className="flex-1 bg-[#0a0a0f] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-gray-200 focus:outline-none focus:border-orange-500 font-mono shadow-inner"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testStatus === 'testing'}
                  className="px-3.5 py-2.5 rounded-xl border border-white/[0.1] bg-[#161622] hover:bg-[#1e1e2d] text-gray-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Wifi className="w-3.5 h-3.5 text-orange-400" />
                  <span>{testStatus === 'testing' ? 'Testing...' : 'Test Connection'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white text-xs font-semibold shadow-md shadow-orange-600/30 shrink-0 cursor-pointer"
                >
                  Save URL
                </button>
              </div>
            </div>
          </div>

          {/* Test Status Feedback */}
          {testStatus === 'success' && (
            <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{testMessage}</span>
            </div>
          )}

          {testStatus === 'error' && (
            <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{testMessage}</span>
            </div>
          )}

          {/* Quick Presets */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <span className="text-gray-500 text-[11px]">Quick Presets:</span>
            <button
              type="button"
              onClick={() => {
                setServerUrl('http://10.10.202.55:8000');
                setTestStatus('idle');
              }}
              className="px-2.5 py-1 rounded-lg bg-orange-500/10 border border-orange-500/25 text-orange-400 hover:bg-orange-500/20 text-[11px] font-mono cursor-pointer"
            >
              Current Wi-Fi: 10.10.202.55:8000
            </button>
            <button
              type="button"
              onClick={() => {
                setServerUrl('http://localhost:8000');
                setTestStatus('idle');
              }}
              className="px-2.5 py-1 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 hover:text-white text-[11px] font-mono cursor-pointer"
            >
              Localhost: 8000
            </button>
          </div>
        </div>
      </div>

      {/* Privacy & Data Ownership */}
      <div className="p-5 rounded-2xl border border-white/[0.08] bg-[#121218]/90 space-y-4 shadow-sm">
        <h3 className="text-sm font-bold text-gray-200 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" /> Privacy & Personal Data Ownership
        </h3>
        <p className="text-xs text-gray-400 leading-relaxed">
          Aapke personal documents, daily activities, memories aur chats 100% private hain aur aapke account tak seemit hain. Aap kisi bhi samay apna data export ya delete kar sakte hain.
        </p>

        <div className="flex flex-wrap gap-3 pt-1">
          <button
            onClick={handleExportData}
            className="px-4 py-2.5 rounded-xl border border-white/[0.1] hover:border-white/[0.2] bg-[#161622] hover:bg-[#1e1e2d] text-xs font-medium text-gray-200 flex items-center gap-2 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4 text-orange-400" /> Export Knowledge & Backup JSON
          </button>

          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to clear your local cache?')) {
                localStorage.removeItem('life_server_url');
                alert('Local cache reset successfully.');
                window.location.reload();
              }
            }}
            className="px-4 py-2.5 rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-xs font-medium text-red-300 flex items-center gap-2 transition-all cursor-pointer"
          >
            <Trash2 className="w-4 h-4 text-red-400" /> Reset Local Settings Cache
          </button>
        </div>
      </div>
    </div>
  );
};
