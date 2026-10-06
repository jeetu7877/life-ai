import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bot,
  Code2,
  Search,
  GraduationCap,
  FileText,
  Globe,
  BarChart3,
  Target,
  Sparkles,
  ArrowRight,
  Zap,
  CheckCircle2,
  Cpu,
  Shield,
  Activity,
  Layers,
  MessageSquare
} from 'lucide-react';

interface AgentInfo {
  id: string;
  name: string;
  role: string;
  description: string;
  model: string;
  status: 'Ready' | 'Active' | 'Idle';
  icon: any;
  accent: string;
  borderAccent: string;
  badgeBg: string;
  capabilities: string[];
  suggestedPrompt: string;
}

const specializedAgents: AgentInfo[] = [
  {
    id: 'coding',
    name: 'Code Architect & Debugger',
    role: 'Full-Stack Software Engineering',
    description: 'Expert in system design, debugging runtime issues, code reviews, unit tests, and refactoring complex codebases.',
    model: 'Gemini 2.5 Pro',
    status: 'Ready',
    icon: Code2,
    accent: 'text-sky-400',
    borderAccent: 'hover:border-sky-500/50',
    badgeBg: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
    capabilities: ['Architecture Design', 'Bug Diagnostics', 'Code Review', 'Refactoring'],
    suggestedPrompt: 'Analyze this code snippet, find potential bottlenecks and optimize performance.'
  },
  {
    id: 'research',
    name: 'Deep Research Specialist',
    role: 'Multi-Source Synthesis & Fact Checking',
    description: 'Performs deep web lookups, aggregates scholarly literature, summarizes cross-disciplinary topics, and verifies claims.',
    model: 'Gemini 2.5 Pro',
    status: 'Active',
    icon: Search,
    accent: 'text-purple-400',
    borderAccent: 'hover:border-purple-500/50',
    badgeBg: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    capabilities: ['Academic Search', 'Fact Verification', 'Executive Briefs', 'Cross-Citation'],
    suggestedPrompt: 'Perform a deep dive research synthesis on recent advances in multimodal AI agents.'
  },
  {
    id: 'study',
    name: 'Socratic Study Mentor',
    role: 'Adaptive Learning & Active Recall',
    description: 'Transforms complex concepts into bite-sized explanations, creates active recall flashcards, and quizzes knowledge.',
    model: 'Gemini 2.5 Flash',
    status: 'Ready',
    icon: GraduationCap,
    accent: 'text-emerald-400',
    borderAccent: 'hover:border-emerald-500/50',
    badgeBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    capabilities: ['Spaced Repetition', 'Active Recall', 'Quiz Generator', 'Concept Breakdown'],
    suggestedPrompt: 'Test my knowledge on database indexing strategies using Socratic questioning.'
  },
  {
    id: 'document',
    name: 'Document & RAG Analyst',
    role: 'PDF & Knowledge Base Extraction',
    description: 'Indexes documents, extracts contracts, retrieves specific clauses, and answers questions grounded purely on verified documents.',
    model: 'Gemini 2.5 Flash',
    status: 'Ready',
    icon: FileText,
    accent: 'text-[#00D9FF]',
    borderAccent: 'hover:border-[#00D9FF]/50',
    badgeBg: 'bg-[#00D9FF]/10 text-[#00D9FF] border-[#00D9FF]/30',
    capabilities: ['OCR Parsing', 'Contract Inspection', 'Vector Retrieval', 'Multi-Doc Compare'],
    suggestedPrompt: 'Review my uploaded documents and extract the key terms, deadlines, and liabilities.'
  },
  {
    id: 'web',
    name: 'Web Navigator & Automator',
    role: 'Real-Time Web Intelligence',
    description: 'Scours public internet sources, verifies news events, fetches live market data, and monitors dynamic web content.',
    model: 'Gemini 2.5 Flash',
    status: 'Ready',
    icon: Globe,
    accent: 'text-cyan-400',
    borderAccent: 'hover:border-cyan-500/50',
    badgeBg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
    capabilities: ['Live Web Search', 'Trend Monitoring', 'Source Citing', 'Price Intelligence'],
    suggestedPrompt: 'Find the latest breaking tech news and summarize what changed in the industry today.'
  },
  {
    id: 'data',
    name: 'Data & Analytics Specialist',
    role: 'Quantitative Analysis & Patterns',
    description: 'Discovers latent trends across your daily logs, tracks habits, and predicts cognitive efficiency patterns.',
    model: 'Gemini 2.5 Pro',
    status: 'Ready',
    icon: BarChart3,
    accent: 'text-amber-400',
    borderAccent: 'hover:border-amber-500/50',
    badgeBg: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    capabilities: ['Trend Detection', 'Metric Correlation', 'Habit Modeling', 'Forecasts'],
    suggestedPrompt: 'Correlate my sleep and activity records over the past month and identify focus peaks.'
  },
  {
    id: 'planning',
    name: 'Strategic Life Planner',
    role: 'Milestone Decomposition & Routines',
    description: 'Transforms vague ambitions into measurable quarterly milestones, daily atomic tasks, and habit tracking schedules.',
    model: 'Gemini 2.5 Flash',
    status: 'Active',
    icon: Target,
    accent: 'text-rose-400',
    borderAccent: 'hover:border-rose-500/50',
    badgeBg: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    capabilities: ['Goal Roadmaps', 'Sprint Planning', 'Routine Optimization', 'Risk Mitigation'],
    suggestedPrompt: 'Help me break down my goal of mastering Full-Stack AI engineering into a 90-day plan.'
  },
  {
    id: 'creative',
    name: 'Creative Content Director',
    role: 'Writing, Ideation & Media Vision',
    description: 'Brainstorms innovative angles, crafts compelling narratives, scripts podcasts, and generates creative concepts.',
    model: 'Gemini 2.5 Flash',
    status: 'Ready',
    icon: Sparkles,
    accent: 'text-fuchsia-400',
    borderAccent: 'hover:border-fuchsia-500/50',
    badgeBg: 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/30',
    capabilities: ['Copywriting', 'Storyboarding', 'Idea Expansion', 'Narrative Structuring'],
    suggestedPrompt: 'Generate 5 high-impact project concepts combining AI agents with smart home automation.'
  }
];

export const AgentsPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedAgent, setSelectedAgent] = useState<AgentInfo | null>(null);

  const handleLaunchAgent = (agent: AgentInfo) => {
    navigate('/chat', {
      state: {
        agentPersona: agent.name,
        initialQuery: `[Act as ${agent.name} - ${agent.role}]: ${agent.suggestedPrompt}`
      }
    });
  };

  return (
    <div className="flex-1 overflow-y-auto w-full p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6 pb-28 md:pb-8 min-h-0 select-none custom-scrollbar">
      {/* Header Banner */}
      <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-[#0E1622] to-[#111B29] border border-[#202B3D] shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#8B5CF6]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#05070B] border border-[#00D9FF]/40 flex items-center justify-center text-[#00D9FF] shadow-[0_0_20px_rgba(0,217,255,0.2)]">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Autonomous AI Agents</h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <Activity className="w-3 h-3 animate-pulse" /> 8 Agents Online
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Specialized autonomous agents ready to solve complex domain-specific tasks in parallel.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/chat')}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#00A8FF] to-[#8B5CF6] hover:from-[#00D9FF] hover:to-[#A855F7] text-white text-xs font-semibold flex items-center gap-1.5 shadow-[0_0_15px_rgba(0,168,255,0.3)] transition-all cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Open Unified Chat
            </button>
          </div>
        </div>

        {/* System Coordination Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-[#202B3D]">
          <div className="p-3 rounded-2xl bg-[#0A0F18]/80 border border-[#202B3D] flex items-center gap-3">
            <Cpu className="w-5 h-5 text-[#00D9FF]" />
            <div>
              <span className="text-xs text-slate-400 block">Agent Core</span>
              <span className="text-base font-bold text-white">Gemini 2.5 Multi</span>
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-[#0A0F18]/80 border border-[#202B3D] flex items-center gap-3">
            <Layers className="w-5 h-5 text-purple-400" />
            <div>
              <span className="text-xs text-slate-400 block">RAG Memory</span>
              <span className="text-base font-bold text-white">Chroma + Graph</span>
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-[#0A0F18]/80 border border-[#202B3D] flex items-center gap-3">
            <Shield className="w-5 h-5 text-emerald-400" />
            <div>
              <span className="text-xs text-slate-400 block">User Privacy</span>
              <span className="text-base font-bold text-emerald-400">Isolated</span>
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-[#0A0F18]/80 border border-[#202B3D] flex items-center gap-3">
            <Zap className="w-5 h-5 text-amber-400" />
            <div>
              <span className="text-xs text-slate-400 block">Execution Mode</span>
              <span className="text-base font-bold text-amber-400">Autonomous</span>
            </div>
          </div>
        </div>
      </div>

      {/* Agents 8-Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {specializedAgents.map((agent) => {
          const Icon = agent.icon;
          return (
            <div
              key={agent.id}
              className={`p-5 rounded-2xl bg-[#0E1622] border border-[#202B3D] ${agent.borderAccent} transition-all flex flex-col justify-between group shadow-lg hover:shadow-[0_0_20px_rgba(0,217,255,0.1)] relative`}
            >
              <div className="space-y-3.5">
                {/* Agent Icon + Status */}
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-[#05070B] border border-[#202B3D] group-hover:border-[#00D9FF]/40 flex items-center justify-center transition-colors">
                    <Icon className={`w-5 h-5 ${agent.accent}`} />
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${agent.badgeBg}`}>
                    {agent.status}
                  </span>
                </div>

                {/* Agent Title & Role */}
                <div>
                  <h3 className="text-sm font-bold text-white group-hover:text-[#00D9FF] transition-colors">
                    {agent.name}
                  </h3>
                  <span className="text-[11px] text-[#00D9FF] font-medium block mt-0.5">
                    {agent.role}
                  </span>
                </div>

                {/* Description */}
                <p className="text-xs text-slate-400 leading-relaxed min-h-[48px]">
                  {agent.description}
                </p>

                {/* Capabilities pills */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {agent.capabilities.map((cap, cIdx) => (
                    <span
                      key={cIdx}
                      className="px-2 py-0.5 rounded-md bg-[#05070B] border border-[#202B3D] text-[10px] text-slate-300"
                    >
                      {cap}
                    </span>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-4 mt-4 border-t border-[#202B3D] flex items-center justify-between">
                <span className="text-[10px] text-slate-500 font-mono">
                  {agent.model}
                </span>
                <button
                  onClick={() => handleLaunchAgent(agent)}
                  className="px-3 py-1.5 rounded-xl bg-[#141C28] hover:bg-gradient-to-r hover:from-[#00A8FF] hover:to-[#00D9FF] hover:text-black border border-[#202B3D] hover:border-[#00D9FF]/40 text-slate-200 text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer shadow"
                >
                  <span>Engage</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
