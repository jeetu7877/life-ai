import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight, ShieldCheck, Lock, User, Mail } from 'lucide-react';

export const AuthPage: React.FC = () => {
  const [isRegister, setIsRegister] = useState<boolean>(false);
  const [email, setEmail] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);

    try {
      if (isRegister) {
        await register({ email, username, password, full_name: fullName });
      } else {
        await login({ username_or_email: username || email, password });
      }
      navigate('/');
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Authentication failed. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#05070B]">
      <div className="w-full max-w-md p-8 rounded-3xl border border-[#202B3D] bg-[#101722] space-y-6 shadow-2xl">
        {/* Brand */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#00A8FF] via-[#00D9FF] to-[#8B5CF6] flex items-center justify-center mx-auto shadow-[0_0_25px_rgba(0,217,255,0.4)]">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            {isRegister ? 'Meet Your AI Companion' : 'Welcome to Life AI'}
          </h2>
          <p className="text-xs text-slate-400">
            {isRegister ? 'Create your private personal AI profile' : 'Sign in to access your memory and timeline'}
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label className="text-xs text-slate-400">Full Name</label>
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
            <label className="text-xs text-slate-400">Username or Email</label>
            <div className="relative mt-1">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username or email"
                className="w-full bg-[#0A0F18] border border-[#202B3D] rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#00D9FF]"
                required
              />
            </div>
          </div>

          {isRegister && (
            <div>
              <label className="text-xs text-slate-400">Email Address</label>
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
            <label className="text-xs text-slate-400">Password</label>
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

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[#00A8FF] to-[#8B5CF6] hover:from-[#00D9FF] hover:to-[#A855F7] disabled:opacity-50 text-white text-xs font-bold tracking-wide flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,168,255,0.4)] transition-all cursor-pointer"
          >
            {isSubmitting ? 'Authenticating...' : isRegister ? 'Create Account' : 'Sign In'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="pt-2 text-center">
          <button
            type="button"
            onClick={() => setIsRegister(!isRegister)}
            className="text-xs text-slate-400 hover:text-[#00D9FF] transition-colors cursor-pointer"
          >
            {isRegister ? 'Already have an account? Sign In' : "Don't have an account? Create One"}
          </button>
        </div>
      </div>
    </div>
  );
};
