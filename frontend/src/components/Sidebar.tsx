import React from 'react';
import { NavLink } from 'react-router-dom';
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
  Settings
} from 'lucide-react';

const navItems = [
  { to: '/', label: 'Home Dashboard', icon: Mic },
  { to: '/chat', label: 'Daily Chat', icon: MessageSquare },
  { to: '/life-map', label: 'Life Map & Twin', icon: Network },
  { to: '/what-if', label: 'What-If Simulations', icon: Sparkles },
  { to: '/journal', label: 'Journal & Retros', icon: BookMarked },
  { to: '/goals', label: 'Goals & Milestones', icon: Target },
  { to: '/study', label: 'AI Study Coach', icon: GraduationCap },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/memories', label: 'Long-Term Memory', icon: Brain },
  { to: '/timeline', label: 'Timeline', icon: Calendar },
  { to: '/documents', label: 'Documents & RAG', icon: FileText },
  { to: '/profile', label: 'Profile', icon: User },
  { to: '/vault', label: 'Secure Vault', icon: Shield },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export const Sidebar: React.FC = () => {
  return (
    <aside className="w-64 border-r border-[#202B3D] bg-[#0A0F18]/60 flex flex-col justify-between p-4 shrink-0 hidden md:flex min-h-[calc(100vh-4rem)]">
      <div className="space-y-1">
        <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-[#94A3B8]">
          Navigation
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-[#00A8FF]/20 to-[#8B5CF6]/20 text-[#00D9FF] border border-[#00D9FF]/40 shadow-[0_0_15px_rgba(0,217,255,0.15)] font-semibold'
                    : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#101722]'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </div>

      {/* Companion Status Card at bottom */}
      <div className="p-3.5 rounded-2xl border border-[#202B3D] bg-[#101722] space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-200">Life AI Engine</span>
          <span className="w-2 h-2 rounded-full bg-[#22C55E]"></span>
        </div>
        <p className="text-[11px] text-[#94A3B8] leading-relaxed">
          Gemini 2.5 Flash + ChromaDB RAG + Structured Memory Active.
        </p>
      </div>
    </aside>
  );
};
