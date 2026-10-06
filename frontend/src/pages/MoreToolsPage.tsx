import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useVoice } from '../context/VoiceContext';
import {
  LayoutGrid,
  Search,
  ScanEye,
  FileText,
  FolderGit2,
  GraduationCap,
  Bot,
  Calendar,
  Target,
  BookMarked,
  Network,
  Sparkles,
  BarChart3,
  Brain,
  Shield,
  Settings,
  User,
  ArrowRight,
  AlarmClock,
  Music,
  CheckCircle2,
  Smartphone,
  Cpu,
  Radio,
  ExternalLink,
  ChevronRight
} from 'lucide-react';

interface ToolItem {
  id: string;
  name: string;
  category: 'Intelligence' | 'Productivity' | 'System' | 'Media';
  description: string;
  path: string;
  icon: any;
  color: string;
  badge?: string;
}

const TOOLS_CATALOG: ToolItem[] = [
  {
    id: 'vision',
    name: 'AI Vision',
    category: 'Intelligence',
    description: 'Multimodal image Q&A, handwritten notes OCR, question solving & diagram analysis.',
    path: '/vision',
    icon: ScanEye,
    color: 'text-[#00D9FF] bg-[#00D9FF]/10 border-[#00D9FF]/30',
    badge: 'NEW'
  },
  {
    id: 'documents',
    name: 'Documents & RAG',
    category: 'Intelligence',
    description: 'Upload PDF resumes, notes and contracts for instant semantic AI retrieval.',
    path: '/documents',
    icon: FileText,
    color: 'text-purple-400 bg-purple-500/10 border-purple-500/30'
  },
  {
    id: 'github',
    name: 'GitHub & Code',
    category: 'Intelligence',
    description: 'Index GitHub codebases, search functions and ask Life AI to explain repository logic.',
    path: '/github',
    icon: FolderGit2,
    color: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
    badge: 'PRO'
  },
  {
    id: 'agents',
    name: 'Autonomous Agents',
    category: 'Intelligence',
    description: '8 specialized domain agents: Coding, Deep Research, Study, Documents & Planning.',
    path: '/agents',
    icon: Bot,
    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    badge: '8 ONLINE'
  },
  {
    id: 'study',
    name: 'AI Study Coach',
    category: 'Productivity',
    description: 'Master technical subjects with spaced repetition, weak-spot tracking and roadmaps.',
    path: '/study',
    icon: GraduationCap,
    color: 'text-amber-400 bg-amber-500/10 border-amber-500/30'
  },
  {
    id: 'notes',
    name: 'Notes & Flashcards',
    category: 'Productivity',
    description: 'Capture markdown thoughts, generate automated summaries and active recall cards.',
    path: '/notes',
    icon: BookMarked,
    color: 'text-rose-400 bg-rose-500/10 border-rose-500/30'
  },
  {
    id: 'timeline',
    name: 'Daily Timeline',
    category: 'Productivity',
    description: 'Chronological timeline of daily activities, interactions, meetings and logs.',
    path: '/timeline',
    icon: Calendar,
    color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30'
  },
  {
    id: 'goals',
    name: 'Goals & Habits',
    category: 'Productivity',
    description: 'Track long-term ambitions, milestone progress bars and daily atomic habit streaks.',
    path: '/goals',
    icon: Target,
    color: 'text-blue-400 bg-blue-500/10 border-blue-500/30'
  },
  {
    id: 'life-map',
    name: 'Life Twin Model',
    category: 'Intelligence',
    description: 'Interactive neural map representing your cognitive priorities, skills and trajectory.',
    path: '/life-map',
    icon: Network,
    color: 'text-violet-400 bg-violet-500/10 border-violet-500/30'
  },
  {
    id: 'what-if',
    name: 'What-If Engine',
    category: 'Intelligence',
    description: 'Run predictive simulations on major life decisions, career pivots and trade-offs.',
    path: '/what-if',
    icon: Sparkles,
    color: 'text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/30'
  },
  {
    id: 'journal',
    name: 'Journal & Retros',
    category: 'Productivity',
    description: 'Daily reflection entries, retrospective analysis and mood tracking log.',
    path: '/journal',
    icon: BookMarked,
    color: 'text-teal-400 bg-teal-500/10 border-teal-500/30'
  },
  {
    id: 'analytics',
    name: 'Cognitive Analytics',
    category: 'Productivity',
    description: 'In-depth performance metrics, productivity rhythms and mental focus metrics.',
    path: '/analytics',
    icon: BarChart3,
    color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30'
  },
  {
    id: 'memories',
    name: 'Long-Term Memory',
    category: 'Intelligence',
    description: 'Inspect auto-extracted facts, neural preferences and user knowledge graph.',
    path: '/memories',
    icon: Brain,
    color: 'text-purple-400 bg-purple-500/10 border-purple-500/30'
  },
  {
    id: 'vault',
    name: 'Encrypted Vault',
    category: 'System',
    description: 'Zero-knowledge client-encrypted store for sensitive keys, passwords and records.',
    path: '/vault',
    icon: Shield,
    color: 'text-red-400 bg-red-500/10 border-red-500/30'
  },
  {
    id: 'alarms',
    name: 'Smart Alarms',
    category: 'Media',
    description: 'OS-level wake-up alarms with voice snoozing and bedtime routines.',
    path: '/alarms',
    icon: AlarmClock,
    color: 'text-amber-400 bg-amber-500/10 border-amber-500/30'
  },
  {
    id: 'music',
    name: 'Music Player',
    category: 'Media',
    description: 'Voice-controlled dynamic YouTube search, playlists and global background playback.',
    path: '/music',
    icon: Music,
    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
  },
  {
    id: 'settings',
    name: 'Settings & Config',
    category: 'System',
    description: 'Manage AI models, voice TTS pitch, wake-word sensitivity, backups and keys.',
    path: '/settings',
    icon: Settings,
    color: 'text-slate-300 bg-slate-700/30 border-slate-600'
  },
  {
    id: 'profile',
    name: 'Personal Profile',
    category: 'System',
    description: 'Configure your identity, bio, goals, custom instructions and avatar.',
    path: '/profile',
    icon: User,
    color: 'text-[#00D9FF] bg-[#00D9FF]/10 border-[#00D9FF]/30'
  }
];

export const MoreToolsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { voiceState, isWakeWordEnabled, isNativePlatform, isBatteryOptimizedExempt } = useVoice();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const categories = ['All', 'Intelligence', 'Productivity', 'Media', 'System'];

  // Top quick access items
  const quickShortcuts = TOOLS_CATALOG.slice(0, 8);

  const filteredTools = TOOLS_CATALOG.filter((tool) => {
    const matchesSearch =
      tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (selectedCategory === 'All') return true;
    return tool.category === selectedCategory;
  });

  return (
    <div className="flex-1 overflow-y-auto w-full p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6 pb-28 md:pb-8 min-h-0 select-none custom-scrollbar">
      {/* Header Banner */}
      <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-[#0E1622] to-[#111B29] border border-[#202B3D] shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#00D9FF]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#05070B] border border-[#00D9FF]/40 flex items-center justify-center text-[#00D9FF] shadow-[0_0_20px_rgba(0,217,255,0.2)]">
              <LayoutGrid className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Intelligence & Tools Suite</h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/15 text-[#00D9FF] border border-[#00D9FF]/30">
                  {TOOLS_CATALOG.length} Apps
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Complete Personal AI Operating System suite for Android, Web and Desktop.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/settings')}
              className="px-3.5 py-2 rounded-xl bg-[#141C28] hover:bg-[#1A2639] border border-[#202B3D] text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5 text-[#00D9FF]" />
              System Settings
            </button>
          </div>
        </div>

        {/* System Diagnostic Status Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-[#202B3D]">
          <div className="p-3 rounded-2xl bg-[#0A0F18]/80 border border-[#202B3D] flex items-center gap-3">
            <Smartphone className="w-4 h-4 text-[#00D9FF]" />
            <div>
              <span className="text-[10px] text-slate-400 block">Platform</span>
              <span className="text-xs font-bold text-white">{isNativePlatform ? 'Android Native' : 'Responsive Web'}</span>
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-[#0A0F18]/80 border border-[#202B3D] flex items-center gap-3">
            <Radio className="w-4 h-4 text-emerald-400" />
            <div>
              <span className="text-[10px] text-slate-400 block">Wake-Word</span>
              <span className="text-xs font-bold text-white">{isWakeWordEnabled ? 'Active' : 'Standby'}</span>
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-[#0A0F18]/80 border border-[#202B3D] flex items-center gap-3">
            <Cpu className="w-4 h-4 text-purple-400" />
            <div>
              <span className="text-[10px] text-slate-400 block">AI Engine</span>
              <span className="text-xs font-bold text-white">Gemini 2.5 Multi</span>
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-[#0A0F18]/80 border border-[#202B3D] flex items-center gap-3">
            <CheckCircle2 className="w-4 h-4 text-[#00D9FF]" />
            <div>
              <span className="text-[10px] text-slate-400 block">Backend Link</span>
              <span className="text-xs font-bold text-[#00D9FF]">Render Cloud</span>
            </div>
          </div>
        </div>
      </div>

      {/* Top Quick Access Scroll Bar (Screen 14 Feature) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
          <span className="font-semibold uppercase tracking-wider text-[10px] text-slate-300">
            Top Feature Shortcuts
          </span>
        </div>
        <div className="flex items-center gap-3 overflow-x-auto pb-2 custom-scrollbar">
          {quickShortcuts.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
                className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl bg-[#0E1622] border border-[#202B3D] hover:border-[#00D9FF]/40 text-left transition-all shrink-0 cursor-pointer shadow-sm group hover:scale-[1.02]"
              >
                <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${item.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="truncate pr-1">
                  <div className="text-xs font-bold text-slate-200 group-hover:text-[#00D9FF] transition-colors truncate">
                    {item.name}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    {item.category}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tools and intelligence apps..."
            className="w-full bg-[#101722] border border-[#202B3D] rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#00D9FF] transition-all"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 custom-scrollbar shrink-0">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-gradient-to-r from-[#00A8FF]/20 to-[#8B5CF6]/20 text-[#00D9FF] border border-[#00D9FF]/40 shadow-[0_0_12px_rgba(0,217,255,0.2)]'
                  : 'bg-[#101722] border border-[#202B3D] text-slate-400 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* 4x3 / 4x4 Grid of Tools */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredTools.map((tool) => {
          const Icon = tool.icon;
          return (
            <div
              key={tool.id}
              onClick={() => navigate(tool.path)}
              className="p-5 rounded-2xl bg-[#0E1622] border border-[#202B3D] hover:border-[#00D9FF]/40 transition-all flex flex-col justify-between group shadow-lg hover:shadow-[0_0_20px_rgba(0,217,255,0.1)] cursor-pointer relative"
            >
              <div className="space-y-3">
                {/* Icon & Badge */}
                <div className="flex items-center justify-between">
                  <div className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${tool.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  {tool.badge && (
                    <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-[#00D9FF]/15 text-[#00D9FF] border border-[#00D9FF]/30">
                      {tool.badge}
                    </span>
                  )}
                </div>

                {/* Name */}
                <div>
                  <h3 className="text-sm font-bold text-white group-hover:text-[#00D9FF] transition-colors">
                    {tool.name}
                  </h3>
                  <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                    {tool.category}
                  </span>
                </div>

                {/* Description */}
                <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                  {tool.description}
                </p>
              </div>

              {/* Bottom launch link */}
              <div className="pt-3 mt-3 border-t border-[#202B3D] flex items-center justify-between text-xs text-slate-400 group-hover:text-[#00D9FF] transition-colors">
                <span className="text-[11px] font-semibold">Launch Tool</span>
                <ChevronRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
