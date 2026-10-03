import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Mic,
  MessageSquare,
  Brain,
  Calendar,
  FileText,
  User,
  Shield,
  Settings
} from 'lucide-react';

const navItems = [
  { to: '/', label: 'Voice Home', icon: Mic },
  { to: '/chat', label: 'Daily Chat', icon: MessageSquare },
  { to: '/memories', label: 'Long-Term Memory', icon: Brain },
  { to: '/timeline', label: 'Timeline', icon: Calendar },
  { to: '/documents', label: 'Documents & RAG', icon: FileText },
  { to: '/profile', label: 'Profile', icon: User },
  { to: '/vault', label: 'Secure Vault', icon: Shield },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export const Sidebar: React.FC = () => {
  return (
    <aside className="w-64 border-r border-gray-800/80 bg-[#0d0d12]/50 flex flex-col justify-between p-4 shrink-0 hidden md:flex min-h-[calc(100vh-4rem)]">
      <div className="space-y-1">
        <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-gray-500">
          Companion Navigation
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
                    ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30 shadow-[0_0_15px_rgba(249,115,22,0.15)] font-semibold'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
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
      <div className="p-3.5 rounded-2xl border border-gray-800/80 bg-[#121217] space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-300">Life Engine</span>
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
        </div>
        <p className="text-[11px] text-gray-400 leading-relaxed">
          Gemini LLM + ChromaDB RAG + Encrypted Vault Active.
        </p>
      </div>
    </aside>
  );
};
