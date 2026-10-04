import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  Mail,
  ShieldCheck,
  Sparkles,
  KeyRound
} from 'lucide-react';

export const VerifyEmailPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();

  const tokenFromUrl = searchParams.get('token') || '';
  const [tokenInput, setTokenInput] = useState<string>(tokenFromUrl);
  const [status, setStatus] = useState<'idle' | 'verifying' | 'success' | 'expired' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  // Resend state
  const [resendEmail, setResendEmail] = useState<string>(user?.email || '');
  const [isResending, setIsResending] = useState<boolean>(false);
  const [resendCooldown, setResendCooldown] = useState<number>(0);
  const [resendStatusMsg, setResendStatusMsg] = useState<string>('');

  // Auto-verify if token is present in URL
  useEffect(() => {
    if (tokenFromUrl) {
      handleVerify(tokenFromUrl);
    }
  }, [tokenFromUrl]);

  // Cooldown countdown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleVerify = async (tokenToVerify: string) => {
    if (!tokenToVerify.trim()) {
      setStatus('error');
      setErrorMessage('Please provide a valid verification token.');
      return;
    }

    setStatus('verifying');
    setErrorMessage('');
    try {
      const res = await api.verifyEmail(tokenToVerify.trim());
      setStatus('success');
      setSuccessMessage(res.message || 'Email verified successfully! Your account is now fully active.');
      if (refreshUser) {
        await refreshUser();
      }
    } catch (err: any) {
      const detail = err.response?.data?.detail || 'Verification failed. Token may be invalid or expired.';
      if (detail.toLowerCase().includes('expired')) {
        setStatus('expired');
      } else {
        setStatus('error');
      }
      setErrorMessage(detail);
    }
  };

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail.trim() || isResending || resendCooldown > 0) return;

    setIsResending(true);
    setResendStatusMsg('');
    try {
      const res = await api.resendVerification(resendEmail.trim());
      setResendStatusMsg(res.message || 'Verification email sent. Check your inbox.');
      setResendCooldown(60); // 60s cooldown
    } catch (err: any) {
      const detail = err.response?.data?.detail || 'Failed to resend verification email.';
      setResendStatusMsg(detail);
      // If server returned 429 rate limit with wait time
      setResendCooldown(60);
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full flex-1 flex flex-col items-center justify-start sm:justify-center p-4 sm:p-6 lg:p-8 bg-[#05070B] overflow-y-auto overflow-x-hidden font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="w-full max-w-md my-auto py-6 sm:py-8">
        <div className="w-full p-6 sm:p-8 rounded-3xl border border-[#202B3D] bg-[#101722] space-y-6 shadow-2xl relative">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#00A8FF] via-[#00D9FF] to-[#8B5CF6] flex items-center justify-center mx-auto shadow-[0_0_25px_rgba(0,217,255,0.3)]">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Account Verification</h2>
          <p className="text-xs text-slate-400">
            Confirm your email address to unlock verified status and secure your Life AI data.
          </p>
        </div>

        {/* State 1: Verifying */}
        {status === 'verifying' && (
          <div className="py-8 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-[#00D9FF] animate-spin mx-auto" />
            <p className="text-sm font-semibold text-slate-200">Verifying your token...</p>
            <p className="text-xs text-slate-400">Communicating with the Life AI authentication vault.</p>
          </div>
        )}

        {/* State 2: Success */}
        {status === 'success' && (
          <div className="py-4 space-y-4 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(16,185,129,0.2)]">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-emerald-300">Email Successfully Verified!</h3>
              <p className="text-xs text-slate-300 leading-relaxed">{successMessage}</p>
            </div>
            <button
              onClick={() => navigate('/')}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#00A8FF] to-[#00D9FF] hover:opacity-90 text-black text-xs font-bold tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-[#00A8FF]/30 transition-all cursor-pointer mt-4"
            >
              Continue to Life AI <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* State 3: Expired / Error */}
        {(status === 'expired' || status === 'error') && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block text-red-200">
                  {status === 'expired' ? 'Verification Link Expired' : 'Invalid Verification Token'}
                </span>
                <span className="text-[11px] leading-relaxed mt-0.5 block">{errorMessage}</span>
              </div>
            </div>

            {/* Resend Form */}
            <form onSubmit={handleResend} className="p-4 rounded-2xl bg-[#0A0F18] border border-[#202B3D] space-y-3">
              <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Mail className="w-4 h-4 text-[#00D9FF]" /> Request a New Verification Link
              </h4>
              <p className="text-[11px] text-slate-400">
                Enter your registered email address below. A fresh secure token will be dispatched.
              </p>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="email"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-[#101722] border border-[#202B3D] rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-[#00D9FF]"
                  required
                />
              </div>

              {resendStatusMsg && (
                <p className="text-[11px] text-[#00D9FF] font-medium">{resendStatusMsg}</p>
              )}

              <button
                type="submit"
                disabled={isResending || resendCooldown > 0}
                className="w-full py-2.5 rounded-xl bg-[#141E2D] hover:bg-[#1A283C] border border-[#223147] disabled:opacity-50 text-xs font-semibold text-slate-200 flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                {isResending ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : resendCooldown > 0 ? (
                  `Resend available in ${resendCooldown}s`
                ) : (
                  'Resend Verification Link'
                )}
              </button>
            </form>
          </div>
        )}

        {/* State 4: Idle (No token provided in URL or manual entry) */}
        {status === 'idle' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-[#00D9FF]" /> Enter Verification Token
              </label>
              <input
                type="text"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Paste your verification token here"
                className="w-full bg-[#0A0F18] border border-[#202B3D] rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#00D9FF] font-mono shadow-inner"
              />
            </div>

            <button
              type="button"
              onClick={() => handleVerify(tokenInput)}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#00A8FF] to-[#8B5CF6] hover:opacity-90 text-white text-xs font-bold tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-[#00A8FF]/20 transition-all cursor-pointer"
            >
              Verify Account <ArrowRight className="w-4 h-4" />
            </button>

            <div className="pt-2 text-center">
              <Link to="/" className="text-xs text-slate-400 hover:text-[#00D9FF] transition-colors">
                Return to Dashboard
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
);
};
