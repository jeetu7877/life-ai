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
  KeyRound,
  Clock,
  ArrowLeft,
  RotateCcw
} from 'lucide-react';
import { api, getServerHostUrl, probeServerHealth } from '../services/api';
import { storage } from '../services/storage';
import axios from 'axios';

interface AuthPageProps {
  initialMode?: 'login' | 'register';
}

export const AuthPage: React.FC<AuthPageProps> = ({ initialMode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { login, register, verifyOtp, isAuthenticated, isLoading } = useAuth();

  // If already authenticated, redirect to home dashboard
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  // Determine initial mode based on prop or URL path
  const isRegisterRoute = initialMode === 'register' || location.pathname === '/register';
  const [isRegister, setIsRegister] = useState<boolean>(isRegisterRoute);

  // Authentication Stage: 'credentials' or 'otp_verification'
  const [authStage, setAuthStage] = useState<'credentials' | 'otp_verification'>('credentials');

  // Credential Form State
  const [fullName, setFullName] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');

  // OTP Verification State
  const [otpEmail, setOtpEmail] = useState<string>('');
  const [otpInput, setOtpInput] = useState<string>('');
  const [otpExpiresIn, setOtpExpiresIn] = useState<number>(600); // 10 minutes in seconds
  const [resendCooldown, setResendCooldown] = useState<number>(60); // 60s cooldown
  const [isResendingOtp, setIsResendingOtp] = useState<boolean>(false);

  // Status and Error Messages
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isEmailSendFailed, setIsEmailSendFailed] = useState<boolean>(false);

  // Server health probe status: 'checking', 'online', 'cold_start', 'offline'
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'cold_start' | 'offline'>('checking');
  const [currentServerUrl, setCurrentServerUrl] = useState<string>(() => getServerHostUrl());
  const [showServerConfig, setShowServerConfig] = useState<boolean>(false);
  const [customServerInput, setCustomServerInput] = useState<string>(() => getServerHostUrl());

  useEffect(() => {
    checkServerHealth(currentServerUrl);
  }, [currentServerUrl]);

  // Countdown timer tick for OTP expiration and resend cooldown
  useEffect(() => {
    if (authStage !== 'otp_verification') return;

    const timer = setInterval(() => {
      setOtpExpiresIn((prev) => (prev > 0 ? prev - 1 : 0));
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [authStage]);

  // Real Server Health Probe with Cold-Start Detection
  const checkServerHealth = async (url: string) => {
    setServerStatus('checking');
    try {
      const res = await probeServerHealth(url, 15000);
      setServerStatus(res.status);
    } catch {
      setServerStatus('offline');
    }
  };

  const handleSaveCustomServer = async () => {
    const cleanUrl = customServerInput.trim().replace(/\/+$/, '');
    if (!cleanUrl) return;
    await storage.setServerUrl(cleanUrl);
    setCurrentServerUrl(cleanUrl);
    setShowServerConfig(false);
    checkServerHealth(cleanUrl);
  };

  const maskEmail = (raw: string): string => {
    if (!raw || typeof raw !== 'string' || !raw.includes('@')) return raw || 'your email';
    const parts = raw.split('@');
    const name = parts[0] || '';
    const domain = parts[1] || '';
    if (!name) return raw;
    if (name.length <= 2) return `${name[0]}*@${domain}`;
    return `${name.slice(0, 2)}${'*'.repeat(Math.max(2, name.length - 2))}@${domain}`;
  };

  const formatSeconds = (sec: number): string => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Submit Credentials (Stage 1: Register or Login)
  const handleSubmitCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setIsEmailSendFailed(false);

    if (isRegister) {
      if (!fullName.trim()) {
        setErrorMsg('Please enter your full name.');
        return;
      }
      if (!email.trim() || !email.includes('@')) {
        setErrorMsg('Please enter a valid email address.');
        return;
      }
      if (!username.trim() || username.trim().length < 3) {
        setErrorMsg('Username must be at least 3 characters.');
        return;
      }
      if (!password || password.length < 6) {
        setErrorMsg('Password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('Passwords do not match. Please verify your password confirmation.');
        return;
      }
    } else {
      if (!username.trim()) {
        setErrorMsg('Please enter your username or email.');
        return;
      }
      if (!password) {
        setErrorMsg('Please enter your password.');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      if (isRegister) {
        // Register creates unverified pending user and sends REAL 6-digit OTP
        const res = await register({
          email: email.trim(),
          username: username.trim(),
          password,
          full_name: fullName.trim()
        });

        setOtpEmail(email.trim());
        setOtpExpiresIn(res?.expires_in_seconds || 600);
        setResendCooldown(res?.resend_cooldown_seconds || 60);
        setAuthStage('otp_verification');
        setSuccessMsg(res?.message || 'Verification OTP code has been sent to your email.');
      } else {
        // Sign In
        await login({
          username_or_email: username.trim(),
          password
        });
        navigate('/', { replace: true });
      }
    } catch (err: any) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail;

      // Unverified account attempt on login (403 Forbidden)
      if (status === 403 && typeof detail === 'string' && detail.toLowerCase().includes('verify')) {
        const targetEmail = email || username.trim();
        setOtpEmail(targetEmail);
        setAuthStage('otp_verification');
        setErrorMsg('Please verify your email before logging in. Enter the OTP below or request a new one.');
        return;
      }

      // Email provider delivery failure (500/503)
      if (status === 500 || status === 503) {
        setIsEmailSendFailed(true);
        setErrorMsg(
          typeof detail === 'string'
            ? detail
            : 'Unable to send verification email. Please check your email configuration and try again.'
        );
        return;
      }

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

  // Submit 6-Digit OTP Verification (Stage 2)
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanOtp = otpInput.trim();
    if (!cleanOtp || cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
      setErrorMsg('Please enter a valid 6-digit numeric OTP.');
      return;
    }

    if (otpExpiresIn <= 0) {
      setErrorMsg('OTP code has expired. Please request a new code.');
      return;
    }

    setIsSubmitting(true);

    try {
      await verifyOtp({
        email: otpEmail,
        otp: cleanOtp
      });
      setSuccessMsg('Account verified successfully! Directing you to Life AI...');
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 500);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setErrorMsg(typeof detail === 'string' ? detail : 'Invalid verification code. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Resend OTP with 60-Second Cooldown
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isResendingOtp) return;

    setIsResendingOtp(true);
    setErrorMsg('');
    setSuccessMsg('');
    setIsEmailSendFailed(false);

    try {
      const res = await api.resendOtp(otpEmail);
      setSuccessMsg(res.message || 'A new 6-digit verification code has been dispatched to your email.');
      setResendCooldown(res.resend_cooldown_seconds || 60);
      setOtpExpiresIn(600);
    } catch (err: any) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail;
      if (status === 429) {
        setErrorMsg(detail || 'Please wait before requesting a new OTP.');
      } else {
        setIsEmailSendFailed(true);
        setErrorMsg(typeof detail === 'string' ? detail : 'Unable to send verification email. Please try again.');
      }
    } finally {
      setIsResendingOtp(false);
    }
  };

  return (
    /* ============================================================== */
    /* 1. AUTH-PAGE (Full dynamic viewport height, scrollable, safe)   */
    /* ============================================================== */
    <div className="min-h-[100dvh] w-full flex-1 flex flex-col items-center justify-start sm:justify-center p-4 sm:p-6 lg:p-8 bg-[#05070B] text-slate-100 font-['Plus_Jakarta_Sans',sans-serif] overflow-y-auto overflow-x-hidden select-none">
      
      {/* ============================================================== */}
      {/* 2. AUTH-CONTAINER (Responsive max-width, vertically centered)  */ }
      {/* ============================================================== */}
      <div className="w-full max-w-md my-auto py-6 sm:py-8 space-y-5">
        
        {/* ============================================================== */}
        {/* 3. AUTH-CARD (Sleek elevated card, no clipping)                */}
        {/* ============================================================== */}
        <div className="w-full p-6 sm:p-8 rounded-3xl border border-[#202B3D] bg-[#101722] space-y-5 shadow-2xl relative">
          
          {/* Brand Header */}
          <div className="text-center space-y-2">
            <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-[#00A8FF] via-[#00D9FF] to-[#8B5CF6] flex items-center justify-center mx-auto shadow-[0_0_25px_rgba(0,217,255,0.4)]">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              {authStage === 'otp_verification'
                ? 'Verify Your Email'
                : isRegister
                ? 'Create Your Account'
                : 'Welcome to Life AI'}
            </h2>
            <p className="text-xs text-slate-400">
              {authStage === 'otp_verification'
                ? 'Enter the 6-digit code sent to activate your account'
                : isRegister
                ? 'Join Life AI — your personal memory, code and voice companion'
                : 'Sign in to access your personal memory graph, companion, and documents'}
            </p>
          </div>

          {/* Real Server Status Indicator (Part 4: No fake status) */}
          <div className="p-2.5 rounded-2xl bg-[#0A0F18] border border-[#202B3D] flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 truncate">
              <Server className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="text-slate-400 text-[11px] truncate">Server:</span>
              <span className="text-slate-200 text-[11px] truncate font-mono">
                {currentServerUrl.replace(/^https?:\/\//, '')}
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {serverStatus === 'online' ? (
                <span className="flex items-center gap-1 text-[10px] text-[#22C55E] bg-[#22C55E]/10 border border-[#22C55E]/30 px-2 py-0.5 rounded-full font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
                  Online
                </span>
              ) : serverStatus === 'cold_start' ? (
                <span className="flex items-center gap-1 text-[10px] text-amber-300 bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 rounded-full font-medium">
                  <RefreshCw className="w-2.5 h-2.5 animate-spin text-amber-400" />
                  Waking up cloud...
                </span>
              ) : serverStatus === 'checking' ? (
                <span className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 rounded-full">
                  <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                  Checking...
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[10px] text-red-400 bg-red-400/10 border border-red-400/30 px-2 py-0.5 rounded-full font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  Offline
                </span>
              )}

              <button
                type="button"
                onClick={() => setShowServerConfig(!showServerConfig)}
                className="text-[10px] text-[#00D9FF] hover:underline ml-1 cursor-pointer"
              >
                Change
              </button>
            </div>
          </div>

          {/* Render Cold-Start Information Notice */}
          {serverStatus === 'cold_start' && (
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] flex items-center gap-2 animate-fadeIn">
              <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0 text-amber-400" />
              <span>Render cloud instance is spinning up from sleep (~15-20s). Please wait...</span>
            </div>
          )}

          {/* Server Config Expansion */}
          {showServerConfig && (
            <div className="p-3.5 rounded-2xl bg-[#0C121D] border border-[#00D9FF]/30 space-y-2.5 animate-fadeIn">
              <span className="text-[11px] font-semibold text-slate-300 block">Server API Host URL</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customServerInput}
                  onChange={(e) => setCustomServerInput(e.target.value)}
                  placeholder="https://life-ai-daoh.onrender.com"
                  className="flex-1 px-3 py-1.5 rounded-xl bg-[#05070B] border border-[#202B3D] text-xs text-white focus:outline-none focus:border-[#00D9FF]"
                />
                <button
                  type="button"
                  onClick={handleSaveCustomServer}
                  className="px-3 py-1.5 rounded-xl bg-[#00D9FF] text-black font-bold text-xs hover:bg-[#00D9FF]/90 cursor-pointer"
                >
                  Save
                </button>
              </div>
              <div className="flex gap-2 pt-1 text-[10px]">
                <button
                  type="button"
                  onClick={async () => {
                    const url = 'https://life-ai-daoh.onrender.com';
                    setCustomServerInput(url);
                    await storage.setServerUrl(url);
                    setCurrentServerUrl(url);
                    setShowServerConfig(false);
                    checkServerHealth(url);
                  }}
                  className="text-[#00D9FF] hover:underline cursor-pointer"
                >
                  Use Render Cloud
                </button>
                <span className="text-slate-600">•</span>
                <button
                  type="button"
                  onClick={async () => {
                    const url = 'http://192.168.1.16:8000';
                    setCustomServerInput(url);
                    await storage.setServerUrl(url);
                    setCurrentServerUrl(url);
                    setShowServerConfig(false);
                    checkServerHealth(url);
                  }}
                  className="text-[#00D9FF] hover:underline cursor-pointer"
                >
                  Use Local Wi-Fi PC
                </button>
              </div>
            </div>
          )}

          {/* Global Error Banner */}
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start justify-between gap-2.5 shadow-md animate-fadeIn">
              <div className="flex items-start gap-2.5 flex-1">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed">{errorMsg}</div>
              </div>
              {isEmailSendFailed && (
                <button
                  type="button"
                  onClick={authStage === 'otp_verification' ? handleResendOtp : handleSubmitCredentials}
                  className="px-2.5 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-200 border border-red-500/40 font-semibold text-[11px] shrink-0 flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  Try Again
                </button>
              )}
            </div>
          )}

          {/* Global Success Banner */}
          {successMsg && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2.5 shadow-md animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{successMsg}</div>
            </div>
          )}

          {/* ============================================================== */}
          {/* STAGE 1: CREDENTIALS (SIGN IN / CREATE ACCOUNT)                 */}
          {/* ============================================================== */}
          {authStage === 'credentials' && (
            <>
              {/* Mode Switcher Tabs */}
              <div className="flex p-1 rounded-2xl bg-[#0A0F18] border border-[#202B3D]">
                <button
                  type="button"
                  onClick={() => {
                    setIsRegister(false);
                    setErrorMsg('');
                    setSuccessMsg('');
                    setIsEmailSendFailed(false);
                  }}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    !isRegister
                      ? 'bg-[#101722] text-[#00D9FF] border border-[#00D9FF]/40 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsRegister(true);
                    setErrorMsg('');
                    setSuccessMsg('');
                    setIsEmailSendFailed(false);
                  }}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isRegister
                      ? 'bg-[#101722] text-[#00D9FF] border border-[#00D9FF]/40 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Create Account
                </button>
              </div>

              <form onSubmit={handleSubmitCredentials} className="space-y-4">
                {isRegister && (
                  <>
                    {/* Full Name */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300 block">Full Name</label>
                      <div className="relative">
                        <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                        <input
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Vikash Yadav"
                          className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[#0A0F18] border border-[#202B3D] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00D9FF] transition-colors"
                          required
                        />
                      </div>
                    </div>

                    {/* Email Address */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300 block">Email Address</label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="name@example.com"
                          className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[#0A0F18] border border-[#202B3D] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00D9FF] transition-colors"
                          required
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Username / Email */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 block">
                    {isRegister ? 'Username' : 'Username or Email'}
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder={isRegister ? 'vikash_dev' : 'your_username or email'}
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[#0A0F18] border border-[#202B3D] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00D9FF] transition-colors"
                      required
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 block">Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[#0A0F18] border border-[#202B3D] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00D9FF] transition-colors"
                      required
                    />
                  </div>
                </div>

                {/* Confirm Password (Register Only) */}
                {isRegister && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 block">Confirm Password</label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[#0A0F18] border border-[#202B3D] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00D9FF] transition-colors"
                        required
                      />
                    </div>
                  </div>
                )}

                {/* Submit Button (Never clipped, always reachable) */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#00A8FF] via-[#00D9FF] to-[#8B5CF6] text-black font-bold text-xs shadow-[0_0_20px_rgba(0,217,255,0.3)] hover:opacity-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-black" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <span>{isRegister ? 'Create Account' : 'Sign In'}</span>
                      <ArrowRight className="w-4 h-4 text-black" />
                    </>
                  )}
                </button>

                {/* Bottom Toggle Link (Part 3) */}
                <div className="text-center pt-1.5">
                  {isRegister ? (
                    <p className="text-xs text-slate-400">
                      Already have an account?{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setIsRegister(false);
                          setErrorMsg('');
                          setSuccessMsg('');
                          setIsEmailSendFailed(false);
                        }}
                        className="text-[#00D9FF] font-semibold hover:underline cursor-pointer"
                      >
                        Sign In
                      </button>
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400">
                      Don't have an account?{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setIsRegister(true);
                          setErrorMsg('');
                          setSuccessMsg('');
                          setIsEmailSendFailed(false);
                        }}
                        className="text-[#00D9FF] font-semibold hover:underline cursor-pointer"
                      >
                        Create Account
                      </button>
                    </p>
                  )}
                </div>
              </form>
            </>
          )}

          {/* ============================================================== */}
          {/* STAGE 2: 6-DIGIT EMAIL OTP VERIFICATION SCREEN (Part 15)        */}
          {/* ============================================================== */}
          {authStage === 'otp_verification' && (
            <form onSubmit={handleVerifyOtp} className="space-y-5 animate-fadeIn">
              {/* Masked Email Notice */}
              <div className="p-4 rounded-2xl bg-[#0A0F18] border border-[#202B3D] text-center space-y-1.5">
                <span className="text-xs text-slate-400 block">We sent a 6-digit verification code to:</span>
                <span className="text-sm font-bold text-[#00D9FF] tracking-wide block font-mono">
                  {maskEmail(otpEmail)}
                </span>
              </div>

              {/* 6-Digit OTP Input */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 block text-center">
                  Enter 6-Digit Verification Code
                </label>
                <div className="flex justify-center">
                  <input
                    type="text"
                    maxLength={6}
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="• • • • • •"
                    autoFocus
                    autoComplete="one-time-code"
                    className="w-full max-w-[280px] text-center tracking-[12px] text-2xl font-mono font-bold py-3.5 rounded-2xl bg-[#0A0F18] border-2 border-[#00D9FF]/50 text-white focus:outline-none focus:border-[#00D9FF] focus:shadow-[0_0_20px_rgba(0,217,255,0.25)] transition-all"
                    required
                  />
                </div>

                {/* Expiration Timer Indicator */}
                <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 pt-1">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    OTP expires in{' '}
                    <strong className={otpExpiresIn < 60 ? 'text-red-400 font-mono' : 'text-slate-200 font-mono'}>
                      {formatSeconds(otpExpiresIn)}
                    </strong>
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || otpInput.length !== 6 || otpExpiresIn <= 0}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#00A8FF] via-[#00D9FF] to-[#8B5CF6] text-black font-bold text-xs shadow-[0_0_20px_rgba(0,217,255,0.3)] hover:opacity-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-black" />
                      <span>Verifying Code...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4 text-black" />
                      <span>Verify Email & Activate Account</span>
                    </>
                  )}
                </button>

                {/* Resend OTP Button with 60-Second Cooldown */}
                <div className="flex items-center justify-between px-1 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthStage('credentials');
                      setErrorMsg('');
                      setSuccessMsg('');
                      setIsEmailSendFailed(false);
                    }}
                    className="text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to form</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={resendCooldown > 0 || isResendingOtp}
                    className={`font-semibold transition-colors cursor-pointer ${
                      resendCooldown > 0 || isResendingOtp
                        ? 'text-slate-500 cursor-not-allowed'
                        : 'text-[#00D9FF] hover:underline'
                    }`}
                  >
                    {isResendingOtp
                      ? 'Dispatching...'
                      : resendCooldown > 0
                      ? `Resend OTP in ${resendCooldown}s`
                      : 'Resend OTP'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Security Footer Notice */}
          <div className="pt-2 border-t border-[#202B3D] text-center">
            <p className="text-[10px] text-slate-500 flex items-center justify-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>256-Bit Cryptographic Memory & OTP Security Active</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
