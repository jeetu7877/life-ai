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
  ArrowLeft
} from 'lucide-react';
import { api, getServerHostUrl } from '../services/api';
import axios from 'axios';

interface AuthPageProps {
  initialMode?: 'login' | 'register';
}

export const AuthPage: React.FC<AuthPageProps> = ({ initialMode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { login, register, verifyOtp, isAuthenticated, isLoading } = useAuth();

  // If already authenticated, redirect to home
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

  // Timer tick for OTP expiration and resend cooldown
  useEffect(() => {
    if (authStage !== 'otp_verification') return;

    const timer = setInterval(() => {
      setOtpExpiresIn((prev) => (prev > 0 ? prev - 1 : 0));
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [authStage]);

  const checkServerHealth = async (url: string) => {
    setServerStatus('checking');
    try {
      const cleanUrl = url.trim().replace(/\/+$/, '');
      const res = await axios.get(`${cleanUrl}/health`, { timeout: 6000 });
      if (res.data?.status === 'ok' || res.data?.status === 'healthy') {
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

  const maskEmail = (raw: string): string => {
    if (!raw || !raw.includes('@')) return raw;
    const [name, domain] = raw.split('@');
    if (name.length <= 2) return `${name[0]}*@${domain}`;
    return `${name.slice(0, 2)}***@${domain}`;
  };

  const formatSeconds = (sec: number): string => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Submit Credentials (Register or Login)
  const handleSubmitCredentials = async (e: React.FormEvent) => {
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
        // Register creates pending account and sends 6-digit OTP
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
        setSuccessMsg(res?.message || 'Verification code sent to your email.');
      } else {
        // Login directly
        await login({
          username_or_email: username.trim(),
          password
        });
        navigate('/', { replace: true });
      }
    } catch (err: any) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail;

      // Handle unverified email error on login (403 Forbidden)
      if (status === 403 && typeof detail === 'string' && detail.toLowerCase().includes('verify')) {
        const targetEmail = email || username.trim();
        setOtpEmail(targetEmail);
        setAuthStage('otp_verification');
        setErrorMsg('Please verify your email before logging in. Enter the OTP below or request a new one.');
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

  // Submit 6-Digit OTP Verification
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
      setErrorMsg('OTP has expired. Please request a new code.');
      return;
    }

    setIsSubmitting(true);

    try {
      await verifyOtp({
        email: otpEmail,
        otp: cleanOtp
      });
      setSuccessMsg('Account activated successfully! Redirecting...');
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 500);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setErrorMsg(typeof detail === 'string' ? detail : 'Verification failed. Please check the OTP.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isResendingOtp || !otpEmail) return;

    setIsResendingOtp(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await api.resendOtp(otpEmail);
      setSuccessMsg(res.message || 'New 6-digit OTP code has been sent to your email.');
      setResendCooldown(res.resend_cooldown_seconds || 60);
      setOtpExpiresIn(600);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setErrorMsg(typeof detail === 'string' ? detail : 'Failed to resend verification OTP.');
    } finally {
      setIsResendingOtp(false);
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
              ? 'Join Life AI — your personal memory, code, and voice companion'
              : 'Sign in to access your personal memory graph and documents'}
          </p>
        </div>

        {/* Server Connection Status Indicator */}
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
            ) : serverStatus === 'checking' ? (
              <span className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 rounded-full">
                <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                Connecting
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

        {/* Server URL Config Expansion */}
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
                onClick={() => {
                  setCustomServerInput('https://life-ai-daoh.onrender.com');
                  localStorage.setItem('life_server_url', 'https://life-ai-daoh.onrender.com');
                  setCurrentServerUrl('https://life-ai-daoh.onrender.com');
                  setShowServerConfig(false);
                  checkServerHealth('https://life-ai-daoh.onrender.com');
                }}
                className="text-[#00D9FF] hover:underline cursor-pointer"
              >
                Use Render Cloud
              </button>
              <span className="text-slate-600">•</span>
              <button
                type="button"
                onClick={() => {
                  setCustomServerInput('http://10.10.202.55:8000');
                  localStorage.setItem('life_server_url', 'http://10.10.202.55:8000');
                  setCurrentServerUrl('http://10.10.202.55:8000');
                  setShowServerConfig(false);
                  checkServerHealth('http://10.10.202.55:8000');
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
          <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-2.5 shadow-md animate-fadeIn">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">{errorMsg}</div>
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
                    <label className="text-xs font-semibold text-slate-300">Full Name</label>
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

                  {/* Email */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Email Address</label>
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
                <label className="text-xs font-semibold text-slate-300">
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
                <label className="text-xs font-semibold text-slate-300">Password</label>
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
                  <label className="text-xs font-semibold text-slate-300">Confirm Password</label>
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

              {/* Submit Button */}
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
            </form>
          </>
        )}

        {/* ============================================================== */}
        {/* STAGE 2: 6-DIGIT EMAIL OTP VERIFICATION SCREEN                   */}
        {/* ============================================================== */}
        {authStage === 'otp_verification' && (
          <form onSubmit={handleVerifyOtp} className="space-y-5 animate-fadeIn">
            {/* Top Notice */}
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
                    : 'Resend OTP Code'}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Security Footer Notice */}
        <div className="pt-2 border-t border-[#202B3D] text-center">
          <p className="text-[10px] text-slate-500 flex items-center justify-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            256-Bit Cryptographic Memory & OTP Security Active
          </p>
        </div>
      </div>
    </div>
  );
};
