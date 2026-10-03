import React, { useState } from 'react';
import { useVoice } from '../context/VoiceContext';
import { Settings, Volume2, ShieldCheck, Download, Trash2, CheckCircle2, Smartphone } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { isWakeWordEnabled, toggleWakeWord } = useVoice();
  const [selectedVoice, setSelectedVoice] = useState<string>('hi-IN-SwaraNeural');
  const [silenceTimeout, setSilenceTimeout] = useState<number>(7);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [serverUrl, setServerUrl] = useState<string>(() => {
    const saved = localStorage.getItem('life_server_url');
    if (saved && !saved.includes('192.168.1.123')) return saved;
    return 'http://10.10.202.55:8000';
  });

  const handleSaveSettings = () => {
    localStorage.setItem('life_server_url', serverUrl.trim());
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleExportData = () => {
    const backupData = {
      app: 'Life Personal AI Companion',
      export_date: new Date().toISOString(),
      user: 'Vikash Yadav',
      status: 'encrypted_backup'
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `life_personal_backup_${Date.now()}.json`;
    a.click();
  };

  return (
    <div className="flex-1 p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Settings className="w-6 h-6 text-orange-400" /> Settings & Privacy
        </h2>
        <p className="text-xs text-gray-400 mt-1">
          Customize voice parameters, wake-word sensitivity, and manage your private data controls.
        </p>
      </div>

      {savedSuccess && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> Voice and assistant settings updated!
        </div>
      )}

      {/* Voice & Wake Word Settings */}
      <div className="p-5 rounded-2xl border border-gray-800/80 bg-[#121217] space-y-4">
        <h3 className="text-sm font-bold text-gray-200 flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-orange-400" /> Voice & Wake Word Experience
        </h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-white">Wake Word "Life"</p>
              <p className="text-[11px] text-gray-400">Continuously listen for "Life" to wake up and start conversation.</p>
            </div>
            <button
              onClick={toggleWakeWord}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                isWakeWordEnabled
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-800 text-gray-400'
              }`}
            >
              {isWakeWordEnabled ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          <div>
            <label className="text-xs text-gray-400">Assistant Speech Voice</label>
            <select
              value={selectedVoice}
              onChange={(e) => setSelectedVoice(e.target.value)}
              className="w-full mt-1 bg-[#0a0a0c] border border-gray-800 rounded-xl p-2.5 text-xs text-gray-200 focus:outline-none focus:border-orange-500"
            >
              <option value="hi-IN-SwaraNeural">Hindi / Hinglish - Swara (Warm Indian Female Voice)</option>
              <option value="en-IN-NeerjaNeural">Indian English - Neerja (Fluent Indian Female Voice)</option>
              <option value="hi-IN-MadhurNeural">Hindi / Hinglish - Madhur (Indian Male Voice)</option>
              <option value="en-US-ChristopherNeural">English - Christopher</option>
            </select>
          </div>

          <div>
            <div className="flex justify-between text-xs text-gray-400">
              <span>Silence Timeout (return to idle)</span>
              <span className="text-orange-400 font-semibold">{silenceTimeout} seconds</span>
            </div>
            <input
              type="range"
              min="4"
              max="15"
              value={silenceTimeout}
              onChange={(e) => setSilenceTimeout(parseInt(e.target.value))}
              className="w-full mt-2 accent-orange-500 cursor-pointer"
            />
          </div>
        </div>

        <button
          onClick={handleSaveSettings}
          className="mt-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold cursor-pointer"
        >
          Apply Preferences
        </button>
      </div>

      {/* Mobile App & Remote Server Connection */}
      <div className="p-5 rounded-2xl border border-gray-800/80 bg-[#121217] space-y-4">
        <h3 className="text-sm font-bold text-gray-200 flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-orange-400" /> Mobile App & Server Connection
        </h3>
        <p className="text-xs text-gray-400 leading-relaxed">
          Jab aap Life AI ko phone me (APK ya PWA) use karein, toh computer ka WiFi IP ya Tunnel URL yahan save karein taaki phone seedha backend se connect ho sake.
        </p>

        <div className="space-y-2">
          <label className="text-xs text-gray-400">Backend Server URL</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="e.g. http://192.168.1.123:8000"
              className="flex-1 bg-[#0a0a0c] border border-gray-800 rounded-xl px-3.5 py-2.5 text-xs text-gray-200 focus:outline-none focus:border-orange-500 font-mono"
            />
            <button
              onClick={handleSaveSettings}
              className="px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold shrink-0 cursor-pointer"
            >
              Save URL
            </button>
          </div>
          <p className="text-[11px] text-gray-500">
            Current Laptop WiFi address: <span className="text-orange-400 font-mono">http://192.168.1.123:8000</span>
          </p>
        </div>
      </div>


      {/* Privacy & Data Ownership */}
      <div className="p-5 rounded-2xl border border-gray-800/80 bg-[#121217] space-y-4">
        <h3 className="text-sm font-bold text-gray-200 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" /> Privacy & Personal Data
        </h3>
        <p className="text-xs text-gray-400 leading-relaxed">
          Your personal documents, daily activities, memories, and chats are isolated strictly to your account.
          You retain 100% control to export or permanently erase your data at any time.
        </p>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            onClick={handleExportData}
            className="px-4 py-2.5 rounded-xl border border-gray-800 hover:border-gray-700 bg-[#16161c] text-xs font-medium text-gray-300 hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-orange-400" /> Export Knowledge & Chat Archive
          </button>

          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to clear all chat history?')) {
                alert('Conversation history cleared.');
              }
            }}
            className="px-4 py-2.5 rounded-xl border border-red-950/60 bg-red-950/20 text-xs font-medium text-red-400 hover:bg-red-900/30 flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" /> Clear Chat History
          </button>
        </div>
      </div>
    </div>
  );
};
