import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Mic,
  MessageSquare,
  Network,
  Sparkles,
  BookMarked,
  Target,
  GraduationCap,
  BarChart3,
  Brain,
  Calendar,
  FileText,
  User,
  Shield,
  Settings,
  LayoutGrid,
  X,
  LogOut,
  ChevronRight,
  AlarmClock,
  Music
} from 'lucide-react';

const mainNavItems = [
  { to: '/', label: 'Home', icon: Mic },
  { to: '/chat', label: 'Chat', icon: MessageSquare },
  { to: '/alarms', label: 'Alarms', icon: AlarmClock },
  { to: '/music', label: 'Music', icon: Music },
];

const allFeatures = [
  {
    category: 'Device & Media Controls',
    items: [
      { to: '/alarms', label: 'Smart Alarms', icon: AlarmClock, desc: 'OS-level wake-up alarms & voice timer' },
      { to: '/music', label: 'Music Player', icon: Music, desc: 'Voice-controlled song streaming' },
    ]
  },
  {
    category: 'Core Assistant',
    items: [
      { to: '/', label: 'Home Dashboard', icon: Mic, desc: 'Voice agent & daily overview' },
      { to: '/chat', label: 'Daily Chat', icon: MessageSquare, desc: 'AI conversation & reasoning' },
      { to: '/profile', label: 'Personal Profile', icon: User, desc: 'Identity, bio, skills & goals' },
      { to: '/settings', label: 'Settings & Config', icon: Settings, desc: 'Voice, models, backup & keys' },
    ]
  },
  {
    category: 'Memory & Knowledge',
    items: [
      { to: '/documents', label: 'Documents & RAG', icon: FileText, desc: 'Upload PDFs, notes & search' },
      { to: '/memories', label: 'Long-Term Memory', icon: Brain, desc: 'Stored facts & graph links' },
      { to: '/timeline', label: 'Daily Timeline', icon: Calendar, desc: 'Activity feed & event history' },
      { to: '/vault', label: 'Secure Vault', icon: Shield, desc: 'Encrypted secrets & notes' },
    ]
  },
  {
    category: 'Intelligence & Growth',
    items: [
      { to: '/life-map', label: 'Life Map & Twin', icon: Network, desc: 'Interactive life graph model' },
      { to: '/goals', label: 'Goals & Targets', icon: Target, desc: 'Milestones & progress tracker' },
      { to: '/study', label: 'AI Study Coach', icon: GraduationCap, desc: 'Adaptive learning & quizzes' },
      { to: '/what-if', label: 'What-If Simulations', icon: Sparkles, desc: 'Future trajectory forecasting' },
      { to: '/journal', label: 'Journal & Retros', icon: BookMarked, desc: 'Reflections & mood logs' },
      { to: '/analytics', label: 'Performance Analytics', icon: BarChart3, desc: 'Habits & cognitive metrics' },
    ]
  }
];

export const MobileBottomNav: React.FC = () => {
  const { isAuthenticated, logout, user } = useAuth();
  const [isMoreOpen, setIsMoreOpen] = useState<boolean>(false);
  const navigate = useNavigate();

  if (!isAuthenticated) {
    return null;
  }

  const handleNavigate = (path: string) => {
    setIsMoreOpen(false);
    navigate(path);
  };

  return (
    <>
      {/* Bottom Navigation Bar in Mobile AppShell Flow */}
      <nav className="md:hidden shrink-0 z-40 bg-[#0A0F18]/95 backdrop-blur-xl border-t border-[#202B3D] px-1 py-1 grid grid-cols-5 items-center w-full max-w-full shadow-2xl safe-bottom select-none">
        {mainNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `w-full min-w-0 flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition-all cursor-pointer text-center ${
                  isActive
                    ? 'text-white font-semibold bg-gradient-to-r from-[#00A8FF]/20 to-[#8B5CF6]/20 border border-[#00D9FF]/40 shadow-[0_0_12px_rgba(0,217,255,0.25)]'
                    : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                }`
              }
            >
              <Icon className="w-4 h-4 mb-0.5 shrink-0" />
              <span className="text-[10px] tracking-tight truncate w-full px-0.5">{item.label}</span>
            </NavLink>
          );
        })}

        {/* More Button */}
        <button
          type="button"
          onClick={() => setIsMoreOpen(true)}
          className={`w-full min-w-0 flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition-all cursor-pointer text-center ${
            isMoreOpen
              ? 'text-white font-semibold bg-gradient-to-r from-[#00A8FF]/20 to-[#8B5CF6]/20 border border-[#00D9FF]/40 shadow-[0_0_12px_rgba(0,217,255,0.25)]'
              : 'text-[#94A3B8] hover:text-[#F8FAFC]'
          }`}
          aria-label="More Features"
        >
          <LayoutGrid className="w-4 h-4 mb-0.5 text-[#00D9FF] shrink-0" />
          <span className="text-[10px] tracking-tight text-[#00D9FF] font-semibold truncate w-full px-0.5">More</span>
        </button>
      </nav>

      {/* Full Feature Bottom-Sheet Modal */}
      {isMoreOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end md:hidden animate-fadeIn">
          {/* Backdrop */}
          <div
            onClick={() => setIsMoreOpen(false)}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
          />

          {/* Sheet Container */}
          <div className="relative bg-[#0A0F18] border-t border-[#202B3D] rounded-t-3xl max-h-[85vh] flex flex-col shadow-2xl z-10 overflow-hidden animate-slideUp">
            {/* Handle & Header */}
            <div className="pt-3 pb-2 px-5 border-b border-[#202B3D] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#00A8FF] to-[#8B5CF6] flex items-center justify-center text-white">
                  <LayoutGrid className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">All Features & Tools</h3>
                  <p className="text-[10px] text-slate-400">Complete Life AI Intelligence Suite</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMoreOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-[#141C28] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Feature Grid */}
            <div className="overflow-y-auto p-4 space-y-4 flex-1">
              {allFeatures.map((group, gIdx) => (
                <div key={gIdx} className="space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">
                    {group.category}
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.to}
                          type="button"
                          onClick={() => handleNavigate(item.to)}
                          className="flex items-center justify-between p-3 rounded-2xl bg-[#101722] border border-[#202B3D] hover:border-[#00D9FF]/40 text-left transition-all active:scale-[0.98]"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-[#05070B] border border-[#202B3D] flex items-center justify-center text-[#00D9FF] shrink-0">
                              <Icon className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-slate-200">{item.label}</div>
                              <div className="text-[10px] text-slate-400 leading-tight">{item.desc}</div>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom Actions */}
            <div className="p-3 border-t border-[#202B3D] bg-[#05070B]/90 flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleNavigate('/settings')}
                className="flex-1 py-2.5 rounded-xl border border-[#202B3D] bg-[#101722] text-xs font-semibold text-slate-200 flex items-center justify-center gap-1.5"
              >
                <Settings className="w-4 h-4 text-[#00D9FF]" />
                Settings
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsMoreOpen(false);
                  logout();
                }}
                className="py-2.5 px-4 rounded-xl border border-red-500/20 bg-red-500/10 text-xs font-semibold text-red-400 flex items-center justify-center gap-1.5"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
