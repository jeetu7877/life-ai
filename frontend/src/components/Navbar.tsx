import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useVoice } from '../context/VoiceContext';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Radio,
  LogOut,
  Mic,
  MicOff,
  Settings,
  User,
  Menu,
  X,
  MessageSquare,
  FileText,
  Brain,
  Calendar,
  Target,
  GraduationCap,
  Network,
  BookMarked,
  BarChart3,
  Shield,
  ChevronRight
} from 'lucide-react';
import { getServerHostUrl } from '../services/api';

export const Navbar: React.FC = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const { isWakeWordEnabled, toggleWakeWord, voiceState } = useVoice();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const navigate = useNavigate();

  const avatarDisplayUrl = user?.avatar_url
    ? user.avatar_url.startsWith('http')
      ? user.avatar_url
      : `${getServerHostUrl()}${user.avatar_url}`
    : null;

  const menuSections = [
    {
      category: 'Core Assistant',
      items: [
        { to: '/', label: 'Home Dashboard', icon: Mic },
        { to: '/chat', label: 'Daily Chat', icon: MessageSquare },
        { to: '/profile', label: 'Personal Profile', icon: User },
        { to: '/settings', label: 'Settings & Config', icon: Settings },
      ]
    },
    {
      category: 'Memory & Knowledge',
      items: [
        { to: '/documents', label: 'Documents & RAG', icon: FileText },
        { to: '/memories', label: 'Long-Term Memory', icon: Brain },
        { to: '/timeline', label: 'Daily Timeline', icon: Calendar },
        { to: '/vault', label: 'Secure Vault', icon: Shield },
      ]
    },
    {
      category: 'Intelligence & Growth',
      items: [
        { to: '/goals', label: 'Goals & Targets', icon: Target },
        { to: '/study', label: 'AI Study Coach', icon: GraduationCap },
        { to: '/life-map', label: 'Life Map & Twin', icon: Network },
        { to: '/what-if', label: 'What-If Simulations', icon: Sparkles },
        { to: '/journal', label: 'Journal & Reflection', icon: BookMarked },
        { to: '/analytics', label: 'Performance Analytics', icon: BarChart3 },
      ]
    }
  ];

  const handleMobileNavClick = (path: string) => {
    setIsMobileMenuOpen(false);
    navigate(path);
  };

  return (
    <>
      <header className="h-14 sm:h-16 border-b border-[#202B3D] bg-[#05070B]/95 backdrop-blur-xl px-2.5 sm:px-6 flex items-center justify-between sticky top-0 z-40 shrink-0 font-['Plus_Jakarta_Sans',sans-serif] w-full max-w-full min-w-0 box-border select-none">
        {/* Left: Mobile Menu Toggle + Brand */}
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
          {isAuthenticated && (
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-1.5 sm:p-2 rounded-xl text-slate-300 hover:text-white hover:bg-[#141C28] transition-colors cursor-pointer shrink-0"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5 text-[#00D9FF]" />
            </button>
          )}

          <Link to="/" className="flex items-center gap-2 group min-w-0">
            <div className="relative shrink-0">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-[#00A8FF] via-[#00D9FF] to-[#8B5CF6] flex items-center justify-center shadow-[0_0_20px_rgba(0,217,255,0.4)] transition-transform group-hover:scale-105">
                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#22C55E] border-2 border-[#05070B]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-base sm:text-xl font-bold tracking-tight text-[#F8FAFC] truncate">
                  Life AI
                </h1>
              </div>
              <p className="text-[10px] text-[#94A3B8] truncate leading-tight">Your Personal AI Companion</p>
            </div>
          </Link>
        </div>

        {/* Center: Voice / Wake-Word Status Pill (Shown on Tablet & Desktop) */}
        {isAuthenticated && (
          <div className="hidden sm:flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 rounded-full border border-[#202B3D] bg-[#0A0F18]/90 backdrop-blur-md shadow-inner shrink-0">
            <div className="flex items-center gap-1.5 shrink-0">
              <span
                className={`w-2 h-2 rounded-full transition-all shrink-0 ${
                  voiceState === 'listening'
                    ? 'bg-[#00D9FF] animate-ping'
                    : voiceState === 'speaking'
                    ? 'bg-[#8B5CF6] animate-pulse'
                    : voiceState === 'thinking'
                    ? 'bg-[#00A8FF] animate-bounce'
                    : isWakeWordEnabled
                    ? 'bg-[#22C55E]'
                    : 'bg-slate-600'
                }`}
              />
              <Radio className={`w-3.5 h-3.5 ${voiceState !== 'idle' ? 'text-[#00D9FF] animate-pulse' : 'text-slate-400'}`} />
            </div>

            <span className="text-xs text-slate-300 hidden lg:inline truncate">
              Wake word <span className="font-semibold text-[#00D9FF]">"Hey Life"</span>
            </span>

            <button
              onClick={toggleWakeWord}
              className={`text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-full transition-all flex items-center gap-1 cursor-pointer shrink-0 ${
                isWakeWordEnabled
                  ? 'bg-[#00D9FF]/15 text-[#00D9FF] border border-[#00D9FF]/40 hover:bg-[#00D9FF]/25'
                  : 'bg-[#141C28] text-slate-400 border border-[#202B3D] hover:bg-[#1A2332]'
              }`}
              title={isWakeWordEnabled ? 'Wake word active - Click to mute' : 'Wake word muted - Click to activate'}
            >
              {isWakeWordEnabled ? (
                <>
                  <Mic className="w-3 h-3 text-[#00D9FF]" />
                  <span className="hidden xs:inline">Active</span>
                </>
              ) : (
                <>
                  <MicOff className="w-3 h-3 text-slate-400" />
                  <span className="hidden xs:inline">Muted</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Right: Profile Pill, Settings & Sign Out */}
        {isAuthenticated ? (
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {/* Clickable Profile Avatar Pill matching reference */}
            <Link
              to="/profile"
              className="relative px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-2xl bg-[#0E1522] hover:bg-[#16202E] border border-[#202B3D] hover:border-[#00D9FF]/40 transition-all cursor-pointer group shrink-0 flex items-center justify-center min-w-[34px] sm:min-w-[40px] shadow-sm"
              title="View & Edit Profile"
            >
              <span className="text-xs sm:text-sm font-bold text-white group-hover:text-[#00D9FF] transition-colors">
                {user?.preferred_name?.[0]?.toUpperCase() || user?.full_name?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase() || 'J'}
              </span>
              <span className="absolute -bottom-0.5 -right-0.5 w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full bg-[#22C55E] border-2 border-[#05070B]" />
            </Link>

            {/* Direct Settings Link Button */}
            <Link
              to="/settings"
              className="p-2 sm:p-2.5 rounded-2xl border border-[#202B3D] bg-[#0E1522] hover:bg-[#16202E] text-slate-300 hover:text-white hover:border-[#00D9FF]/40 transition-all flex items-center justify-center cursor-pointer shrink-0 shadow-sm"
              title="System Settings"
            >
              <Settings className="w-4 h-4 text-slate-300" />
            </Link>

            {/* Sign Out Button (Visible on sm: and up; in Drawer on mobile) */}
            <button
              onClick={logout}
              className="hidden sm:flex p-2 sm:px-2.5 sm:py-1.5 rounded-xl border border-[#202B3D] bg-[#101722] text-slate-400 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/10 transition-all items-center gap-1.5 text-xs cursor-pointer shrink-0"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/login"
              className="px-3.5 py-1.5 rounded-xl border border-[#202B3D] text-xs font-semibold text-slate-300 hover:text-white hover:bg-[#141C28] transition-colors"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#00A8FF] to-[#00D9FF] text-black text-xs font-bold hover:opacity-90 transition-opacity"
            >
              Create Account
            </Link>
          </div>
        )}
      </header>

      {/* Slide-out Mobile Navigation Drawer (For Android & Mobile screens) */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden animate-fadeIn">
          {/* Backdrop */}
          <div
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
          />

          {/* Drawer Content */}
          <div className="relative w-4/5 max-w-xs bg-[#0A0F18] border-r border-[#202B3D] h-full flex flex-col justify-between p-4 shadow-2xl z-10 overflow-y-auto">
            <div className="space-y-4">
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[#202B3D]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#00A8FF] to-[#8B5CF6] flex items-center justify-center text-white">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white tracking-tight">Life AI</h2>
                    <span className="text-[10px] text-slate-400">All Features & Tools</span>
                  </div>
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* User Account Card */}
              {user && (
                <div
                  onClick={() => handleMobileNavClick('/profile')}
                  className="p-3 rounded-2xl bg-[#101722] border border-[#202B3D] hover:border-[#00D9FF]/40 flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <div className="w-9 h-9 rounded-xl overflow-hidden border border-[#00D9FF]/40 bg-[#05070B] flex items-center justify-center text-white font-bold text-xs shrink-0">
                      {avatarDisplayUrl ? (
                        <img src={avatarDisplayUrl} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <span>{user?.preferred_name?.[0] || user?.username?.[0] || 'U'}</span>
                      )}
                    </div>
                    <div className="truncate">
                      <span className="text-xs font-bold text-slate-200 block truncate">
                        {user.full_name || user.username}
                      </span>
                      <span className="text-[10px] text-slate-400 block truncate">
                        {user.email}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              )}

              {/* Navigation Sections */}
              <div className="space-y-4">
                {menuSections.map((sec, idx) => (
                  <div key={idx} className="space-y-1">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 px-2 block">
                      {sec.category}
                    </span>
                    {sec.items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.to}
                          type="button"
                          onClick={() => handleMobileNavClick(item.to)}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-[#141C28] transition-colors text-left cursor-pointer"
                        >
                          <Icon className="w-4 h-4 text-[#00D9FF] shrink-0" />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-[#202B3D] space-y-2 mt-4">
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  logout();
                }}
                className="w-full py-2.5 rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
