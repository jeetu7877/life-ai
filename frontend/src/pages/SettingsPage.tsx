import React, { useState, useEffect } from 'react';
import { useVoice } from '../context/VoiceContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ui/Toast';
import { ConfirmationDialog } from '../components/ui/ConfirmationDialog';
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
  GitBranch,
  User,
  Shield,
  Eye,
  Palette,
  Cpu,
  Bell,
  Trash2,
  Info,
  Server,
  Zap,
  KeyRound,
  ExternalLink
} from 'lucide-react';
import axios from 'axios';
import { api, getServerHostUrl } from '../services/api';
import { storage } from '../services/storage';
import { Link, useNavigate } from 'react-router-dom';

type SettingsTab =
  | 'account'
  | 'security'
  | 'privacy'
  | 'appearance'
  | 'voice'
  | 'ai'
  | 'notifications'
  | 'memory'
  | 'data'
  | 'connected'
  | 'about';

export const SettingsPage: React.FC = () => {
  const { user, logout, refreshUser } = useAuth();
  const { success, error, info } = useToast();
  const navigate = useNavigate();

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

  const [activeTab, setActiveTab] = useState<SettingsTab>('account');

  // Account & Verification State
  const [isResendingVerify, setIsResendingVerify] = useState<boolean>(false);
  const [verifyMessage, setVerifyMessage] = useState<string>('');

  // Security (Password Change)
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [isChangingPassword, setIsChangingPassword] = useState<boolean>(false);

  // Delete Account Dialog & Password
  const [showDeleteAccountDialog, setShowDeleteAccountDialog] = useState<boolean>(false);
  const [deletePassword, setDeletePassword] = useState<string>('');
  const [isDeletingAccount, setIsDeletingAccount] = useState<boolean>(false);

  // Voice & Audio
  const [selectedVoice, setSelectedVoice] = useState<string>(() => localStorage.getItem('life_voice_preference') || 'hi-IN-SwaraNeural');
  const [silenceTimeout, setSilenceTimeout] = useState<number>(() => parseInt(localStorage.getItem('life_silence_timeout') || '7'));

  // Appearance
  const [themePreference, setThemePreference] = useState<string>(() => localStorage.getItem('life_theme') || 'cyber-dark');
  const [accentColor, setAccentColor] = useState<string>(() => localStorage.getItem('life_accent_color') || 'cyan');

  // AI & Routing
  const [preferredModel, setPreferredModel] = useState<string>(() => localStorage.getItem('life_ai_model') || 'gemini-2.5-flash');
  const [bypassSimpleQueries, setBypassSimpleQueries] = useState<boolean>(() => localStorage.getItem('life_ai_bypass') !== 'false');
  const [aiTemperature, setAiTemperature] = useState<number>(() => parseFloat(localStorage.getItem('life_ai_temp') || '0.7'));

  // Privacy
  const [telemetryEnabled, setTelemetryEnabled] = useState<boolean>(() => localStorage.getItem('life_telemetry') !== 'false');
  const [incognitoMode, setIncognitoMode] = useState<boolean>(() => localStorage.getItem('life_incognito') === 'true');

  // Notifications
  const [morningBriefEnabled, setMorningBriefEnabled] = useState<boolean>(() => localStorage.getItem('life_notify_morning') !== 'false');
  const [proactiveAlertsEnabled, setProactiveAlertsEnabled] = useState<boolean>(() => localStorage.getItem('life_notify_proactive') !== 'false');

  // Memory
  const [autoExtractMemories, setAutoExtractMemories] = useState<boolean>(() => localStorage.getItem('life_auto_extract') !== 'false');
  const [memoryThreshold, setMemoryThreshold] = useState<number>(() => parseFloat(localStorage.getItem('life_mem_threshold') || '0.7'));

  // Server URL & Probe
  const [serverUrl, setServerUrl] = useState<string>(() => {
    const saved = localStorage.getItem('life_server_url');
    if (saved && !saved.includes('192.168.1.123')) return saved;
    return 'https://life-ai-daoh.onrender.com';
  });
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

  useEffect(() => {
    fetchGitHubStatus();
  }, []);

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

  const handleConnectGitHub = async () => {
    if (!ghTokenInput.trim()) {
      setGhMessage({ type: 'error', text: 'Please enter a valid GitHub Personal Access Token (PAT).' });
      return;
    }
    setGhLoading(true);
    setGhMessage(null);
    try {
      await api.connectGitHub(ghTokenInput.trim(), ghUsernameInput.trim() || undefined);
      setGhMessage({ type: 'success', text: 'Connected GitHub account successfully!' });
      setGhTokenInput('');
      await fetchGitHubStatus();
      success('GitHub connected successfully!');
    } catch (err: any) {
      setGhMessage({ type: 'error', text: err.response?.data?.detail || 'GitHub connection failed.' });
      error('GitHub connection failed.');
    } finally {
      setGhLoading(false);
    }
  };

  const handleIndexRepo = async (repoName?: string) => {
    const target = (repoName || ghRepoInput).trim();
    if (!target) {
      setGhMessage({ type: 'error', text: 'Please enter a repository name (e.g., owner/repo or repo).' });
      return;
    }
    setGhLoading(true);
    setGhMessage({ type: 'info', text: `Cloning and indexing repository '${target}'...` });
    try {
      const res = await api.indexGitHubRepo(target);
      setGhMessage({
        type: 'success',
        text: `Indexed '${res.repository}' successfully! Indexed ${res.files_count} files (${res.chunks_indexed} vectors).`
      });
      setGhRepoInput('');
      await fetchGitHubStatus();
      success(`Indexed repository '${target}' into Code Brain.`);
    } catch (err: any) {
      setGhMessage({ type: 'error', text: err.response?.data?.detail || `Failed to index '${target}'.` });
      error(`Failed to index repository '${target}'.`);
    } finally {
      setGhLoading(false);
    }
  };

  const handleIndexAllRepos = async () => {
    setGhLoading(true);
    setGhMessage({ type: 'info', text: 'Scanning all user repositories and indexing technical code files...' });
    try {
      const res = await api.indexAllGitHubRepos();
      setGhMessage({
        type: 'success',
        text: `Indexed ${res.repos_indexed} of ${res.total_repos_found} repositories (${res.total_chunks_indexed} code chunks).`
      });
      await fetchGitHubStatus();
      success(`Auto-indexed ${res.repos_indexed} repositories.`);
    } catch (err: any) {
      setGhMessage({ type: 'error', text: err.response?.data?.detail || 'Failed to auto-index all repositories.' });
      error('Failed to auto-index repositories.');
    } finally {
      setGhLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!user?.email || isResendingVerify) return;
    setIsResendingVerify(true);
    try {
      const res = await api.resendVerification(user.email);
      setVerifyMessage(res.message);
      success('Verification email sent! Check your inbox.');
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Failed to resend verification email.';
      setVerifyMessage(msg);
      error(msg);
    } finally {
      setIsResendingVerify(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      error('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      error('New passwords do not match.');
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await api.changePassword({
        current_password: currentPassword,
        new_password: newPassword
      });
      success(res.message || 'Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      error(err.response?.data?.detail || 'Failed to change password.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      error('Password is required to confirm account deletion.');
      return;
    }
    setIsDeletingAccount(true);
    try {
      await api.deleteAccount(deletePassword);
      success('Your Life AI account and all associated data have been permanently deleted.');
      logout();
      navigate('/auth');
    } catch (err: any) {
      error(err.response?.data?.detail || 'Failed to delete account.');
      setIsDeletingAccount(false);
    }
  };

  const handleExportData = async () => {
    info('Preparing your encrypted Life AI data archive...');
    try {
      const data = await api.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `life_ai_export_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      success('Data archive downloaded successfully!');
    } catch (err: any) {
      console.error('Export error:', err);
      error('Failed to export data archive.');
    }
  };

  const handleTestConnection = async () => {
    setTestStatus('testing');
    setTestMessage('Pinging server health probe...');
    const targetUrl = serverUrl.trim().replace(/\/+$/, '');
    const startTime = Date.now();
    try {
      const res = await axios.get(`${targetUrl}/health`, { timeout: 15000 });
      const elapsed = Date.now() - startTime;
      if (res.data?.status === 'ok' || res.data?.status === 'healthy') {
        setTestStatus('success');
        setTestMessage(`Connected! Status: Healthy • Latency: ${elapsed}ms • DB: ${res.data.database || 'connected'}`);
        localStorage.setItem('life_server_url', targetUrl);
        await storage.setServerUrl(targetUrl);
        success('Backend connection verified!');
      } else {
        setTestStatus('error');
        setTestMessage(`Server responded with non-healthy status: ${JSON.stringify(res.data)}`);
      }
    } catch (err: any) {
      setTestStatus('error');
      setTestMessage(err.message || 'Cannot reach server at this address.');
      error('Cannot connect to server.');
    }
  };

  const tabs: { id: SettingsTab; label: string; icon: any }[] = [
    { id: 'account', label: 'Account', icon: User },
    { id: 'security', label: 'Security', icon: Lock },
    { id: 'voice', label: 'Voice & Wake Word', icon: Volume2 },
    { id: 'connected', label: 'Connected Services', icon: Code2 },
    { id: 'ai', label: 'AI & Routing', icon: Cpu },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'privacy', label: 'Privacy', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'memory', label: 'Memory Policy', icon: Database },
    { id: 'data', label: 'Data & Backup', icon: Download },
    { id: 'about', label: 'About Life AI', icon: Info }
  ];

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden w-full max-w-5xl mx-auto p-3.5 sm:p-6 space-y-5 pb-36 md:pb-12 min-h-0 min-w-0">
      {/* Header */}
      <div className="min-w-0">
        <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <Settings className="w-5 h-5 sm:w-6 sm:h-6 text-[#00D9FF] shrink-0" /> System Settings
        </h2>
        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
          Configure your personal AI assistant, account security, voice triggers, model routing, and storage.
        </p>
      </div>

      {/* Tabs Bar with smooth horizontal scrolling */}
      <div className="w-full min-w-0 overflow-x-auto pb-2 border-b border-[#202B3D] flex items-center gap-1.5 scrollbar-thin select-none">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                isActive
                  ? 'bg-gradient-to-r from-[#00A8FF]/20 to-[#00D9FF]/20 text-[#00D9FF] border border-[#00D9FF]/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#141C28]'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: ACCOUNT */}
      {activeTab === 'account' && (
        <div className="space-y-4 min-w-0">
          <div className="p-4 sm:p-5 rounded-2xl border border-[#202B3D] bg-[#101722] space-y-4 min-w-0 overflow-hidden">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <User className="w-4 h-4 text-[#00D9FF] shrink-0" /> Account Overview
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 min-w-0">
              <div className="p-3.5 rounded-xl bg-[#0A0F18] border border-[#202B3D] min-w-0">
                <span className="text-[11px] text-slate-400 block">Username</span>
                <span className="text-xs font-semibold text-slate-200 mt-0.5 block truncate">
                  @{user?.username || 'anonymous'}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#0A0F18] border border-[#202B3D] min-w-0">
                <span className="text-[11px] text-slate-400 block">Email Address</span>
                <span className="text-xs font-semibold text-slate-200 mt-0.5 block truncate" title={user?.email}>
                  {user?.email || 'user@example.com'}
                </span>
              </div>
            </div>

            {/* Email Verification Section */}
            <div className="p-3.5 sm:p-4 rounded-xl bg-[#0A0F18] border border-[#202B3D] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 min-w-0">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-200">Email Verification Status</span>
                  {user?.is_verified ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1 shrink-0">
                      <CheckCircle2 className="w-3 h-3" /> Verified
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1 shrink-0">
                      <AlertCircle className="w-3 h-3" /> Unverified
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed break-words">
                  {user?.is_verified
                    ? 'Your email address is verified. Full account security features are unlocked.'
                    : 'Verify your email to guarantee permanent cloud sync and account recovery.'}
                </p>
                {verifyMessage && (
                  <p className="text-[11px] text-[#00D9FF] font-medium mt-1 break-words">{verifyMessage}</p>
                )}
              </div>
              {!user?.is_verified && (
                <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                  <button
                    onClick={handleResendVerification}
                    disabled={isResendingVerify}
                    className="flex-1 sm:flex-initial px-3 py-1.5 rounded-xl bg-[#16202E] hover:bg-[#1E2D40] border border-[#202B3D] text-xs font-semibold text-slate-200 transition-colors cursor-pointer text-center"
                  >
                    {isResendingVerify ? 'Sending...' : 'Resend Link'}
                  </button>
                  <Link
                    to="/verify-email"
                    className="flex-1 sm:flex-initial px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#00A8FF] to-[#00D9FF] text-black text-xs font-bold cursor-pointer text-center"
                  >
                    Enter Token
                  </Link>
                </div>
              )}
            </div>

            {/* Danger Zone: Delete Account */}
            <div className="pt-4 border-t border-[#202B3D] min-w-0">
              <h4 className="text-xs font-bold text-red-400 mb-1 flex items-center gap-1.5">
                <Trash2 className="w-4 h-4 shrink-0" /> Danger Zone
              </h4>
              <p className="text-[11px] text-slate-400 mb-3 leading-relaxed break-words">
                Permanently delete your Life AI account, long-term memory graph, uploaded documents, and conversations. This action cannot be undone.
              </p>
              <button
                type="button"
                onClick={() => setShowDeleteAccountDialog(true)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-xs font-bold text-red-400 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Trash2 className="w-3.5 h-3.5 shrink-0" /> Delete Account & Wipe Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SECURITY */}
      {activeTab === 'security' && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl border border-[#202B3D] bg-[#101722] space-y-4">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#00D9FF]" /> Change Password
            </h3>
            <form onSubmit={handleChangePassword} className="space-y-3 max-w-md">
              <div>
                <label className="text-xs text-slate-400 font-medium">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full mt-1.5 bg-[#0A0F18] border border-[#202B3D] rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#00D9FF]"
                  required
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 font-medium">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full mt-1.5 bg-[#0A0F18] border border-[#202B3D] rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#00D9FF]"
                  required
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 font-medium">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full mt-1.5 bg-[#0A0F18] border border-[#202B3D] rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#00D9FF]"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isChangingPassword}
                className="mt-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#00A8FF] to-[#8B5CF6] hover:from-[#00D9FF] hover:to-[#A855F7] disabled:opacity-50 text-white text-xs font-bold cursor-pointer transition-all flex items-center gap-2"
              >
                {isChangingPassword ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                {isChangingPassword ? 'Updating Password...' : 'Update Password'}
              </button>
            </form>
          </div>

          <div className="p-5 rounded-2xl border border-[#202B3D] bg-[#101722] space-y-3">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" /> Active Session
            </h3>
            <p className="text-xs text-slate-400">
              Authenticated via JWT Bearer Token stored securely in encrypted client storage.
            </p>
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#0A0F18] border border-[#202B3D] text-xs">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-[#00D9FF]" />
                <span className="text-slate-200 font-medium">Current Device Session</span>
              </div>
              <span className="text-emerald-400 font-semibold flex items-center gap-1 text-[11px]">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Active
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: VOICE & WAKE WORD */}
      {activeTab === 'voice' && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl border border-[#202B3D] bg-[#101722] space-y-4">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-[#00D9FF]" /> Voice Assistant & Hands-Free
            </h3>

            <div className="space-y-3">
              {/* Wake Word Toggle */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#0A0F18] border border-[#202B3D]">
                <div>
                  <span className="text-xs font-bold text-slate-200 block">"Hey Life" Wake Word Detection</span>
                  <span className="text-[11px] text-slate-400 mt-0.5 block">
                    Continuously listens for wake trigger phrase to activate voice assistant.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={toggleWakeWord}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                    isWakeWordEnabled ? 'bg-[#00D9FF]' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      isWakeWordEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Hands-Free Loop Toggle */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#0A0F18] border border-[#202B3D]">
                <div>
                  <span className="text-xs font-bold text-slate-200 block">Hands-Free Continuous Loop</span>
                  <span className="text-[11px] text-slate-400 mt-0.5 block">
                    Automatically resumes listening after Life AI finishes speaking its response.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={toggleHandsFreeMode}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                    isHandsFreeMode ? 'bg-[#00D9FF]' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      isHandsFreeMode ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Voice Output Selection */}
              <div className="p-3.5 rounded-xl bg-[#0A0F18] border border-[#202B3D] space-y-2">
                <label className="text-xs font-bold text-slate-200 block">TTS Voice Model</label>
                <select
                  value={selectedVoice}
                  onChange={(e) => {
                    setSelectedVoice(e.target.value);
                    localStorage.setItem('life_voice_preference', e.target.value);
                    success(`Voice set to ${e.target.value}`);
                  }}
                  className="w-full bg-[#101722] border border-[#202B3D] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-[#00D9FF]"
                >
                  <option value="hi-IN-SwaraNeural">Swara (Hindi/Hinglish Natural Female)</option>
                  <option value="hi-IN-MadhurNeural">Madhur (Hindi/Hinglish Natural Male)</option>
                  <option value="en-IN-NeerjaNeural">Neerja (Indian English Natural)</option>
                  <option value="en-US-JennyNeural">Jenny (US English Natural)</option>
                </select>
              </div>

              {/* Silence Timeout */}
              <div className="p-3.5 rounded-xl bg-[#0A0F18] border border-[#202B3D] space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-slate-200">Silence Detection Timeout</span>
                  <span className="font-semibold text-[#00D9FF]">{silenceTimeout} seconds</span>
                </div>
                <input
                  type="range"
                  min="3"
                  max="15"
                  value={silenceTimeout}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setSilenceTimeout(val);
                    localStorage.setItem('life_silence_timeout', val.toString());
                  }}
                  className="w-full accent-[#00D9FF] cursor-pointer"
                />
              </div>

              {/* Android Battery Optimization Exemption */}
              {isNativePlatform && (
                <div className="p-3.5 rounded-xl bg-[#0A0F18] border border-[#202B3D] flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-200 block">Android Background Execution</span>
                    <span className="text-[11px] text-slate-400 mt-0.5 block">
                      Prevent OS from killing voice service when screen is locked.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={requestBatteryOptimizationExemption}
                    className="px-3 py-1.5 rounded-xl bg-[#16202E] hover:bg-[#1E2D40] border border-[#202B3D] text-xs font-semibold text-[#00D9FF]"
                  >
                    {isBatteryOptimizedExempt ? 'Exempted ✓' : 'Grant Exemption'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: CONNECTED SERVICES & GITHUB */}
      {activeTab === 'connected' && (
        <div className="space-y-4">
          {/* GitHub Code Brain */}
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
              Connect your GitHub account with a Personal Access Token (PAT). Life AI indexes repositories into ChromaDB vector memory for instant code architecture Q&A.
            </p>

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
                          <Sparkles className="w-3 h-3" /> Auto-Index All Repos
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

          {/* Backend Server Probe */}
          <div className="p-5 rounded-2xl border border-[#202B3D] bg-[#101722] space-y-4 shadow-sm">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Server className="w-4 h-4 text-[#8B5CF6]" /> Server URL & Probe
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="https://life-ai-daoh.onrender.com or http://localhost:8000"
                className="flex-1 bg-[#0A0F18] border border-[#202B3D] rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#00D9FF]"
              />
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testStatus === 'testing'}
                className="px-4 py-2.5 rounded-xl bg-[#16202E] hover:bg-[#1E2D40] border border-[#202B3D] text-xs font-semibold text-slate-200 cursor-pointer flex items-center gap-1.5"
              >
                {testStatus === 'testing' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5 text-[#00D9FF]" />}
                Ping
              </button>
            </div>
            {testMessage && (
              <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                testStatus === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                  : 'bg-red-500/10 border-red-500/20 text-red-300'
              }`}>
                {testStatus === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-red-400" />}
                <span>{testMessage}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: AI & ROUTING */}
      {activeTab === 'ai' && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl border border-[#202B3D] bg-[#101722] space-y-4">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[#00D9FF]" /> Intelligence Model & Smart Routing
            </h3>

            <div className="p-3.5 rounded-xl bg-[#0A0F18] border border-[#202B3D] space-y-2">
              <label className="text-xs font-bold text-slate-200 block">Default Primary Model</label>
              <select
                value={preferredModel}
                onChange={(e) => {
                  setPreferredModel(e.target.value);
                  localStorage.setItem('life_ai_model', e.target.value);
                  success(`Default model switched to ${e.target.value}`);
                }}
                className="w-full bg-[#101722] border border-[#202B3D] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-[#00D9FF]"
              >
                <option value="gemini-2.5-flash">Google Gemini 2.5 Flash (Ultra-Low Latency Cloud)</option>
                <option value="gemini-2.5-pro">Google Gemini 2.5 Pro (Deep Reasoning Cloud)</option>
                <option value="ollama-local">Ollama Local (Offline Self-Hosted)</option>
              </select>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#0A0F18] border border-[#202B3D]">
              <div>
                <span className="text-xs font-bold text-slate-200 block">Fast Query Routing & Cache Bypass</span>
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  Answers roll numbers, phone numbers, and cached memories in under 150ms without invoking LLM tokens.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const nextVal = !bypassSimpleQueries;
                  setBypassSimpleQueries(nextVal);
                  localStorage.setItem('life_ai_bypass', nextVal.toString());
                  success(`Fast query bypass ${nextVal ? 'enabled' : 'disabled'}`);
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                  bypassSimpleQueries ? 'bg-[#00D9FF]' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    bypassSimpleQueries ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0A0F18] border border-[#202B3D] space-y-2">
              <div className="flex justify-between text-xs">
                <span className="font-bold text-slate-200">Sampling Temperature</span>
                <span className="font-semibold text-[#00D9FF]">{aiTemperature.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={aiTemperature}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setAiTemperature(val);
                  localStorage.setItem('life_ai_temp', val.toString());
                }}
                className="w-full accent-[#00D9FF] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>Exact / Factual (0.1)</span>
                <span>Balanced (0.7)</span>
                <span>Creative (1.0)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: APPEARANCE */}
      {activeTab === 'appearance' && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl border border-[#202B3D] bg-[#101722] space-y-4">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Palette className="w-4 h-4 text-[#00D9FF]" /> Theme & Visual Design
            </h3>

            <div className="p-3.5 rounded-xl bg-[#0A0F18] border border-[#202B3D] space-y-2">
              <label className="text-xs font-bold text-slate-200 block">Color Theme</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { id: 'cyber-dark', label: 'Cyber Dark (Default)' },
                  { id: 'oled-black', label: 'OLED Pure Black' },
                  { id: 'midnight-navy', label: 'Midnight Navy' }
                ].map((th) => (
                  <button
                    key={th.id}
                    type="button"
                    onClick={() => {
                      setThemePreference(th.id);
                      localStorage.setItem('life_theme', th.id);
                      success(`Theme switched to ${th.label}`);
                    }}
                    className={`p-3 rounded-xl border text-xs font-semibold text-center transition-all cursor-pointer ${
                      themePreference === th.id
                        ? 'bg-[#00D9FF]/10 border-[#00D9FF] text-[#00D9FF]'
                        : 'bg-[#101722] border-[#202B3D] text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    {th.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: PRIVACY */}
      {activeTab === 'privacy' && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl border border-[#202B3D] bg-[#101722] space-y-4">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" /> Data Privacy & Protection
            </h3>

            <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#0A0F18] border border-[#202B3D]">
              <div>
                <span className="text-xs font-bold text-slate-200 block">Performance Telemetry</span>
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  Store response latency timing stats to track local search speeds.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const nextVal = !telemetryEnabled;
                  setTelemetryEnabled(nextVal);
                  localStorage.setItem('life_telemetry', nextVal.toString());
                  success(`Telemetry ${nextVal ? 'enabled' : 'disabled'}`);
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                  telemetryEnabled ? 'bg-[#00D9FF]' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    telemetryEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#0A0F18] border border-[#202B3D]">
              <div>
                <span className="text-xs font-bold text-slate-200 block">Incognito Query Mode</span>
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  Do not record conversation messages into the long-term memory graph.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const nextVal = !incognitoMode;
                  setIncognitoMode(nextVal);
                  localStorage.setItem('life_incognito', nextVal.toString());
                  success(`Incognito mode ${nextVal ? 'activated' : 'deactivated'}`);
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                  incognitoMode ? 'bg-[#00D9FF]' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    incognitoMode ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 8: NOTIFICATIONS */}
      {activeTab === 'notifications' && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl border border-[#202B3D] bg-[#101722] space-y-4">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#00D9FF]" /> Proactive Notifications
            </h3>

            <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#0A0F18] border border-[#202B3D]">
              <div>
                <span className="text-xs font-bold text-slate-200 block">Daily Morning Briefing</span>
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  Synthesizes daily priorities, calendar events, and top goal milestones.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const nextVal = !morningBriefEnabled;
                  setMorningBriefEnabled(nextVal);
                  localStorage.setItem('life_notify_morning', nextVal.toString());
                  success(`Morning briefing ${nextVal ? 'enabled' : 'disabled'}`);
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                  morningBriefEnabled ? 'bg-[#00D9FF]' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    morningBriefEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#0A0F18] border border-[#202B3D]">
              <div>
                <span className="text-xs font-bold text-slate-200 block">Proactive Habit & Risk Alerts</span>
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  Alerts you when milestones have had no activity for more than 48 hours.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const nextVal = !proactiveAlertsEnabled;
                  setProactiveAlertsEnabled(nextVal);
                  localStorage.setItem('life_notify_proactive', nextVal.toString());
                  success(`Proactive alerts ${nextVal ? 'enabled' : 'disabled'}`);
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                  proactiveAlertsEnabled ? 'bg-[#00D9FF]' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    proactiveAlertsEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 9: MEMORY POLICY */}
      {activeTab === 'memory' && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl border border-[#202B3D] bg-[#101722] space-y-4">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Database className="w-4 h-4 text-[#8B5CF6]" /> Long-Term Memory Policy
            </h3>

            <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#0A0F18] border border-[#202B3D]">
              <div>
                <span className="text-xs font-bold text-slate-200 block">Autonomous Memory Extraction</span>
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  Background worker extracts facts, preferences, and achievements from every conversation turn.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const nextVal = !autoExtractMemories;
                  setAutoExtractMemories(nextVal);
                  localStorage.setItem('life_auto_extract', nextVal.toString());
                  success(`Autonomous memory extraction ${nextVal ? 'enabled' : 'disabled'}`);
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                  autoExtractMemories ? 'bg-[#00D9FF]' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    autoExtractMemories ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0A0F18] border border-[#202B3D] space-y-2">
              <div className="flex justify-between text-xs">
                <span className="font-bold text-slate-200">Memory Confidence Threshold</span>
                <span className="font-semibold text-[#00D9FF]">{(memoryThreshold * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="0.95"
                step="0.05"
                value={memoryThreshold}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setMemoryThreshold(val);
                  localStorage.setItem('life_mem_threshold', val.toString());
                }}
                className="w-full accent-[#00D9FF] cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 10: DATA & BACKUP */}
      {activeTab === 'data' && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl border border-[#202B3D] bg-[#101722] space-y-4">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Download className="w-4 h-4 text-[#00D9FF]" /> Export & Local Storage
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Export a complete encrypted JSON dump of your profile, memory graph nodes, goals, milestones, timeline logs, and document metadata.
            </p>
            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={handleExportData}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#00A8FF] to-[#00D9FF] text-black font-bold text-xs flex items-center gap-2 cursor-pointer shadow-md shadow-[#00A8FF]/20"
              >
                <Download className="w-4 h-4" /> Download Full JSON Archive
              </button>
              <button
                type="button"
                onClick={() => {
                  const token = localStorage.getItem('life_token');
                  const refresh = localStorage.getItem('life_refresh_token');
                  const server = localStorage.getItem('life_server_url');
                  const user = localStorage.getItem('life_user');
                  localStorage.clear();
                  if (token) localStorage.setItem('life_token', token);
                  if (refresh) localStorage.setItem('life_refresh_token', refresh);
                  if (server) localStorage.setItem('life_server_url', server);
                  if (user) localStorage.setItem('life_user', user);
                  success('Temporary client cache cleared (session preserved).');
                  window.location.reload();
                }}
                className="px-4 py-2.5 rounded-xl border border-[#202B3D] bg-[#141C28] hover:bg-[#1A2332] text-xs font-semibold text-slate-300 transition-colors cursor-pointer"
              >
                Clear Client Cache
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 11: ABOUT */}
      {activeTab === 'about' && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl border border-[#202B3D] bg-[#101722] space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#00A8FF] to-[#8B5CF6] flex items-center justify-center text-white">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight">Life AI Personal Operating System</h3>
                <span className="text-[11px] text-slate-400">Version 2.4.0 (Production Edition)</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0A0F18] border border-[#202B3D] space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-[#1A2332]">
                <span className="text-slate-400">Architecture</span>
                <span className="font-semibold text-slate-200">Hybrid Agentic RAG + Personal Knowledge Graph</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#1A2332]">
                <span className="text-slate-400">Vector Store</span>
                <span className="font-semibold text-slate-200">ChromaDB Multi-Collection Embeddings</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#1A2332]">
                <span className="text-slate-400">Core Relational DB</span>
                <span className="font-semibold text-slate-200">SQLite (Local) / PostgreSQL (Cloud Render)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#1A2332]">
                <span className="text-slate-400">Wake Word Engine</span>
                <span className="font-semibold text-slate-200">Web Speech API / Capacitor Android Foreground Loop</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Voice Synthesis</span>
                <span className="font-semibold text-slate-200">Neural TTS Multi-Voice Pipeline</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog: Delete Account */}
      <ConfirmationDialog
        isOpen={showDeleteAccountDialog}
        title="Permanently Delete Account"
        message="This action will irreversibly wipe all your personal memories, documents, embeddings, and chat history. Enter your password below to confirm."
        confirmLabel={isDeletingAccount ? "Deleting..." : "Permanently Delete Everything"}
        cancelLabel="Cancel"
        isDangerous={true}
        isLoading={isDeletingAccount}
        onConfirm={handleDeleteAccount}
        onCancel={() => {
          setShowDeleteAccountDialog(false);
          setDeletePassword('');
        }}
      />
    </div>
  );
};
