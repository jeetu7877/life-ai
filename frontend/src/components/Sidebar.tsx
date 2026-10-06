import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getServerHostUrl } from '../services/api';
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
  User as UserIcon,
  Shield,
  Settings as SettingsIcon,
  LogOut,
  ChevronRight,
  AlarmClock,
  Music,
  ScanEye,
  FolderGit2,
  Bot,
  LayoutGrid
} from 'lucide-react';

const navItems = [
  { to: '/', label: 'Home', icon: Mic },
  { to: '/chat', label: 'Chat', icon: MessageSquare },
  { to: '/music', label: 'Music', icon: Music },
  { to: '/alarms', label: 'Alarms', icon: AlarmClock },
  { to: '/vision', label: 'AI Vision', icon: ScanEye },
  { to: '/documents', label: 'Documents', icon: FileText },
  { to: '/github', label: 'GitHub', icon: FolderGit2 },
  { to: '/study', label: 'Study', icon: GraduationCap },
  { to: '/agents', label: 'Agents', icon: Bot },
  { to: '/timeline', label: 'Timeline', icon: Calendar },
  { to: '/goals', label: 'Goals', icon: Target },
  { to: '/notes', label: 'Notes', icon: BookMarked },
  { to: '/more', label: 'Tools', icon: LayoutGrid },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
  { to: '/profile', label: 'Profile', icon: UserIcon },
];

export const Sidebar: React.FC = () => {
  const { user, logout, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return null;
  }

  const avatarDisplayUrl = user?.avatar_url
    ? user.avatar_url.startsWith('http')
      ? user.avatar_url
      : `${getServerHostUrl()}${user.avatar_url}`
    : null;

  return (
    <aside className="w-64 border-r border-[#202B3D] bg-[#0A0F18]/80 backdrop-blur-md flex flex-col justify-between p-3.5 shrink-0 hidden md:flex min-h-0 h-full select-none">
      {/* Scrollable Navigation List */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-1 custom-scrollbar min-h-0">
        <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
          Navigation
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
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

      {/* Footer Area: User Profile Card & Engine Status */}
      <div className="pt-3 border-t border-[#202B3D] space-y-2.5 shrink-0">
        {/* User Card */}
        {user && (
          <div className="p-2.5 rounded-xl border border-[#202B3D] bg-[#101722] hover:border-[#00D9FF]/30 transition-all flex items-center justify-between group">
            <Link
              to="/profile"
              className="flex items-center gap-2.5 min-w-0 flex-1 hover:opacity-90"
              title="View profile"
            >
              <div className="w-8 h-8 rounded-lg overflow-hidden border border-[#00D9FF]/40 bg-[#0A0F18] flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm">
                {avatarDisplayUrl ? (
                  <img src={avatarDisplayUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span>{user.preferred_name?.[0] || user.username?.[0] || 'U'}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-200 truncate group-hover:text-[#00D9FF] transition-colors">
                  {user.preferred_name || user.full_name || user.username}
                </p>
                <p className="text-[10px] text-slate-400 truncate">
                  {user.email}
                </p>
              </div>
            </Link>

            <div className="flex items-center gap-1 pl-1 shrink-0">
              <Link
                to="/settings"
                className="p-1.5 rounded-lg text-slate-400 hover:text-[#00D9FF] hover:bg-[#1A2332] transition-colors"
                title="Settings"
              >
                <SettingsIcon className="w-3.5 h-3.5" />
              </Link>
              <button
                type="button"
                onClick={logout}
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Companion Engine Status Card */}
        <div className="p-2.5 rounded-xl border border-[#202B3D]/80 bg-[#0C121D] space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-300">Life AI Core</span>
            <span className="flex items-center gap-1 text-[10px] text-[#22C55E]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse"></span>
              Live
            </span>
          </div>
          <p className="text-[10px] text-slate-400 leading-tight">
            Gemini 2.5 Flash + ChromaDB RAG
          </p>
        </div>
      </div>
    </aside>
  );
};
