import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Lock,
  User,
  Mail,
  AlertCircle,
  CheckCircle2,
  Server,
  RefreshCw,
  KeyRound
} from 'lucide-react';
import { getServerHostUrl } from '../services/api';
import axios from 'axios';

interface AuthPageProps {
  initialMode?: 'login' | 'register';
}

export const AuthPage: React.FC<AuthPageProps> = ({ initialMode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { login, register, isAuthenticated, isLoading } = useAuth();

  // If already authenticated, redirect to home
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  // Determine initial mode based on prop or URL path
  const isRegisterRoute = initialMode === 'register' || location.pathname === '/register';
  const [isRegister, setIsRegister] = useState<boolean>(isRegisterRoute);

  const [fullName, setFullName] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');

  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Server health probe status on login screen
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [currentServerUrl, setCurrentServerUrl] = useState<string>(() => getServerHostUrl());
  const [showServerConfig, setShowServerConfig] = useState<boolean>(false);
  const [customServerInput, setCustomServerInput] = useState<string>(() => getServerHostUrl());

  useEffect(() => {
    checkServerHealth(currentServerUrl);
  }, [currentServerUrl]);

  const checkServerHealth = async (url: string) => {
    setServerStatus('checking');
    try {
      const cleanUrl = url.trim().replace(/\/+$/, '');
      const res = await axios.get(`${cleanUrl}/health`, { timeout: 6000 });
      if (res.data?.status === 'ok') {
        setServerStatus('online');
      } else {
        setServerStatus('offline');
      }
    } catch {
      setServerStatus('offline');
    }
  };

  const handleSaveCustomServer = () => {
    const cleanUrl = customServerInput.trim().replace(/\/+$/, '');
    localStorage.setItem('life_server_url', cleanUrl);
    setCurrentServerUrl(cleanUrl);
    setShowServerConfig(false);
    checkServerHealth(cleanUrl);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (isRegister) {
      if (!fullName.trim()) {
        setErrorMsg('Please enter your full name.');
        return;
      }
      if (!username.trim() || username.length < 3) {
        setErrorMsg('Username must be at least 3 characters long.');
        return;
      }
      if (!email.trim() || !email.includes('@')) {
        setErrorMsg('Please enter a valid email address.');
        return;
      }
      if (password.length < 6) {
        setErrorMsg('Password must be at least 6 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('Passwords do not match. Please re-enter.');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      if (isRegister) {
        await register({
          email: email.trim(),
          username: username.trim(),
          password,
          full_name: fullName.trim()
        });
        setSuccessMsg('Account created successfully! Welcome to Life AI.');
        navigate('/', { replace: true });
      } else {
        await login({
          username_or_email: username.trim(),
          password
        });
        navigate('/', { replace: true });
      }
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      if (typeof detail === 'string') {
        setErrorMsg(detail);
      } else if (Array.isArray(detail) && detail[0]?.msg) {
        setErrorMsg(detail[0].msg);
      } else if (err.message && err.message.includes('Network Error')) {
        setErrorMsg(`Cannot reach server at ${currentServerUrl}. Please check backend connection.`);
      } else {
        setErrorMsg('Authentication failed. Please check your credentials.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#05070B] font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="w-full max-w-md p-6 sm:p-8 rounded-3xl border border-[#202B3D] bg-[#101722] space-y-6 shadow-2xl relative">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#00A8FF] via-[#00D9FF] to-[#8B5CF6] flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(0,217,255,0.4)]">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            {isRegister ? 'Create Your Account' : 'Welcome to Life AI'}
          </h2>
          <p className="text-xs text-slate-400">
            {isRegister
              ? 'Join Life AI — your personal memory, code, and voice companion'
              : 'Sign in to access your personal memory graph and documents'}
          </p>
        </div>

        {/* Tab Switcher: Sign In vs Create Account */}
        <div className="flex p-1 bg-[#0A0F18] border border-[#202B3D] rounded-xl">
          <button
            type="button"
            onClick={() => {
              setIsRegister(false);
              setErrorMsg('');
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              !isRegister
                ? 'bg-gradient-to-r from-[#00A8FF]/20 to-[#00D9FF]/20 text-[#00D9FF] border border-[#00D9FF]/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setIsRegister(true);
              setErrorMsg('');
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              isRegister
                ? 'bg-gradient-to-r from-[#00A8FF]/20 to-[#00D9FF]/20 text-[#00D9FF] border border-[#00D9FF]/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Status Messages */}
        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{successMsg}</span>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {isRegister && (
            <div>
              <label className="text-[11px] font-semibold text-slate-300">Full Name</label>
              <div className="relative mt-1">
                <User className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Vikash Yadav"
                  className="w-full bg-[#0A0F18] border border-[#202B3D] rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#00D9FF]"
                  required
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-[11px] font-semibold text-slate-300">
              {isRegister ? 'Username' : 'Username or Email'}
            </label>
            <div className="relative mt-1">
              <User className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={isRegister ? 'Choose a unique username' : 'Enter username or email'}
                className="w-full bg-[#0A0F18] border border-[#202B3D] rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#00D9FF]"
                required
              />
            </div>
          </div>

          {isRegister && (
            <div>
              <label className="text-[11px] font-semibold text-slate-300">Email Address</label>
              <div className="relative mt-1">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-[#0A0F18] border border-[#202B3D] rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#00D9FF]"
                  required
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-[11px] font-semibold text-slate-300">Password</label>
            <div className="relative mt-1">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-[#0A0F18] border border-[#202B3D] rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#00D9FF]"
                required
              />
            </div>
          </div>

          {isRegister && (
            <div>
              <label className="text-[11px] font-semibold text-slate-300">Confirm Password</label>
              <div className="relative mt-1">
                <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  className="w-full bg-[#0A0F18] border border-[#202B3D] rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#00D9FF]"
                  required
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-[#00A8FF] to-[#8B5CF6] hover:from-[#00D9FF] hover:to-[#A855F7] disabled:opacity-50 text-white text-xs font-bold tracking-wide flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,168,255,0.4)] transition-all cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>{isRegister ? 'Creating Account...' : 'Signing In...'}</span>
              </>
            ) : (
              <>
                <span>{isRegister ? 'Complete Registration' : 'Sign In to Life AI'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Verification Link Shortcut */}
        <div className="text-center pt-1 border-t border-[#1C283B]">
          <Link
            to="/verify-email"
            className="text-[11px] text-slate-400 hover:text-[#00D9FF] transition-colors"
          >
            Have a verification token? Verify email here
          </Link>
        </div>

        {/* Server Connection Badge & Configuration (Useful for Android APK) */}
        <div className="pt-2 text-[10px] text-slate-500 flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <span
                className={`w-2 h-2 rounded-full ${
                  serverStatus === 'online'
                    ? 'bg-emerald-400'
                    : serverStatus === 'checking'
                    ? 'bg-amber-400 animate-ping'
                    : 'bg-red-400'
                }`}
              />
              Server: {serverStatus === 'online' ? 'Online' : serverStatus === 'checking' ? 'Checking...' : 'Offline'}
            </span>
            <span>•</span>
            <button
              type="button"
              onClick={() => setShowServerConfig(!showServerConfig)}
              className="text-slate-400 hover:text-[#00D9FF] underline cursor-pointer"
            >
              {showServerConfig ? 'Hide Server Settings' : 'Change Server URL'}
            </button>
          </div>

          {showServerConfig && (
            <div className="w-full mt-2 p-3 rounded-xl bg-[#0A0F18] border border-[#202B3D] space-y-2 text-left">
              <label className="text-[10px] text-slate-400 font-semibold block">Backend Server URL</label>
              <input
                type="text"
                value={customServerInput}
                onChange={(e) => setCustomServerInput(e.target.value)}
                placeholder="https://life-ai-daoh.onrender.com or http://10.10.202.55:8000"
                className="w-full bg-[#101722] border border-[#202B3D] rounded-lg px-2.5 py-1.5 text-[11px] text-slate-200 focus:outline-none focus:border-[#00D9FF]"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSaveCustomServer}
                  className="px-3 py-1 bg-gradient-to-r from-[#00A8FF] to-[#00D9FF] text-black font-bold rounded-lg text-[10px] cursor-pointer"
                >
                  Save & Connect
                </button>
                <button
                  type="button"
                  onClick={() => checkServerHealth(customServerInput)}
                  className="px-2.5 py-1 bg-[#141E2D] border border-[#202B3D] text-slate-300 rounded-lg text-[10px] cursor-pointer"
                >
                  Ping
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
