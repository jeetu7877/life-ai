import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useToast } from '../components/ui/Toast';
import {
  GitBranch,
  Search,
  ExternalLink,
  RefreshCw,
  FolderGit2,
  Star,
  GitFork,
  Code2,
  Sparkles,
  Key,
  CheckCircle2,
  AlertCircle,
  Database,
  ArrowRight,
  ShieldCheck,
  Cpu,
  Layers,
  Terminal
} from 'lucide-react';

interface RepoItem {
  id?: number | string;
  name: string;
  full_name?: string;
  description?: string;
  html_url?: string;
  stargazers_count?: number;
  forks_count?: number;
  language?: string;
  updated_at?: string;
  is_indexed?: boolean;
}

export const GitHubPage: React.FC = () => {
  const navigate = useNavigate();
  const { success, error, info } = useToast();

  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [username, setUsername] = useState<string>('');
  const [indexedReposCount, setIndexedReposCount] = useState<number>(0);
  const [indexedRepos, setIndexedRepos] = useState<any[]>([]);
  const [repositories, setRepositories] = useState<RepoItem[]>([]);
  const [filteredRepos, setFilteredRepos] = useState<RepoItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string>('All');

  // Token modal / connect state
  const [showConnectModal, setShowConnectModal] = useState<boolean>(false);
  const [tokenInput, setTokenInput] = useState<string>('');
  const [usernameInput, setUsernameInput] = useState<string>('');
  const [isConnecting, setIsConnecting] = useState<boolean>(false);

  // Indexing state
  const [indexingRepoName, setIndexingRepoName] = useState<string | null>(null);

  // AI Explain Repo modal
  const [explainingRepo, setExplainingRepo] = useState<RepoItem | null>(null);

  useEffect(() => {
    loadGitHubData();
  }, []);

  const loadGitHubData = async () => {
    setIsLoading(true);
    try {
      const status = await api.getGitHubStatus();
      setIsConnected(status.is_connected);
      setUsername(status.username || '');
      setIndexedReposCount(status.indexed_repositories_count || 0);
      setIndexedRepos(status.indexed_repositories || []);

      if (status.is_connected) {
        try {
          const listRes = await api.listGitHubRepos();
          const list = listRes?.repositories || [];
          setRepositories(list);
          setFilteredRepos(list);
        } catch {
          // If remote list fails, fallback to indexed repos
          setRepositories(status.indexed_repositories || []);
          setFilteredRepos(status.indexed_repositories || []);
        }
      } else {
        // Default showcased demo/system repositories for immediate experience
        const defaultShowcase: RepoItem[] = [
          {
            name: 'Life-AI-OS',
            full_name: 'life-ai/Life-AI-OS',
            description: 'Personal AI Operating System with voice engine, multimodal vision, memory RAG & autonomous agents.',
            language: 'TypeScript',
            stargazers_count: 142,
            forks_count: 28,
            updated_at: new Date().toISOString(),
            is_indexed: true
          },
          {
            name: 'neural-memory-graph',
            full_name: 'life-ai/neural-memory-graph',
            description: 'Long-term cognitive memory engine with Chroma vector search and relational graph clustering.',
            language: 'Python',
            stargazers_count: 89,
            forks_count: 14,
            updated_at: new Date(Date.now() - 86400000 * 2).toISOString(),
            is_indexed: true
          },
          {
            name: 'voice-companion-core',
            full_name: 'life-ai/voice-companion-core',
            description: 'Android native wake-word engine, EdgeTTS streaming & real-time audio focus coordinator.',
            language: 'Kotlin',
            stargazers_count: 65,
            forks_count: 9,
            updated_at: new Date(Date.now() - 86400000 * 5).toISOString(),
            is_indexed: false
          }
        ];
        setRepositories(defaultShowcase);
        setFilteredRepos(defaultShowcase);
      }
    } catch (err) {
      console.error('Failed to load GitHub data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) return;

    setIsConnecting(true);
    info('Connecting GitHub account and verifying API token...');
    try {
      const res = await api.connectGitHub(tokenInput.trim(), usernameInput.trim() || undefined);
      success(`Connected to GitHub successfully${res.username ? ` as @${res.username}` : ''}!`);
      setShowConnectModal(false);
      setTokenInput('');
      setUsernameInput('');
      await loadGitHubData();
    } catch (err: any) {
      console.error('Failed to connect GitHub:', err);
      error(err.response?.data?.detail || 'Failed to authenticate with GitHub token.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleIndexRepo = async (repoName: string) => {
    setIndexingRepoName(repoName);
    info(`Indexing ${repoName} for AI RAG search...`);
    try {
      const res = await api.indexGitHubRepo(repoName);
      success(`Indexed ${res.repository}: ${res.files_count} files, ${res.chunks_indexed} code chunks.`);
      await loadGitHubData();
    } catch (err: any) {
      console.error('Indexing failed:', err);
      error(err.response?.data?.detail || `Failed to index ${repoName}.`);
    } finally {
      setIndexingRepoName(null);
    }
  };

  const handleExplainInChat = (repo: RepoItem) => {
    navigate('/chat', {
      state: {
        initialQuery: `Explain the architecture, key modules, and purpose of the repository "${repo.name}" (${repo.description || 'codebase'}).`
      }
    });
  };

  // Filter repos by search and tag
  useEffect(() => {
    let result = repositories;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        r =>
          r.name.toLowerCase().includes(q) ||
          (r.description && r.description.toLowerCase().includes(q)) ||
          (r.language && r.language.toLowerCase().includes(q))
      );
    }
    if (selectedTag !== 'All') {
      result = result.filter(r => r.language === selectedTag);
    }
    setFilteredRepos(result);
  }, [searchQuery, selectedTag, repositories]);

  const uniqueLanguages = ['All', ...Array.from(new Set(repositories.map(r => r.language).filter(Boolean))) as string[]];

  const getLanguageColor = (lang?: string) => {
    switch (lang?.toLowerCase()) {
      case 'typescript':
        return 'text-sky-400 bg-sky-500/10 border-sky-500/30';
      case 'javascript':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      case 'python':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
      case 'kotlin':
      case 'java':
        return 'text-purple-400 bg-purple-500/10 border-purple-500/30';
      case 'go':
      case 'rust':
        return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30';
      default:
        return 'text-slate-400 bg-slate-800 border-slate-700';
    }
  };

  return (
    <div className="flex-1 overflow-y-auto w-full p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6 pb-28 md:pb-8 min-h-0 select-none custom-scrollbar">
      {/* Header Profile / Status Card */}
      <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-[#0E1622] to-[#111B29] border border-[#202B3D] shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#00D9FF]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#05070B] border border-[#00D9FF]/40 flex items-center justify-center text-[#00D9FF] shadow-[0_0_20px_rgba(0,217,255,0.2)]">
              <FolderGit2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">GitHub & Code Intelligence</h1>
                {isConnected ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Connected
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/15 text-[#00D9FF] border border-[#00D9FF]/30">
                    Showcase Mode
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {isConnected
                  ? `@${username || 'user'} • ${repositories.length} repositories available • ${indexedReposCount} indexed for AI code search`
                  : 'Connect your personal GitHub account to index codebases, search repositories and chat with code.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowConnectModal(true)}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#00A8FF] to-[#8B5CF6] hover:from-[#00D9FF] hover:to-[#A855F7] text-white text-xs font-semibold flex items-center gap-1.5 shadow-[0_0_15px_rgba(0,168,255,0.3)] transition-all cursor-pointer"
            >
              <Key className="w-3.5 h-3.5" />
              {isConnected ? 'Manage Token' : 'Connect GitHub'}
            </button>
            <button
              onClick={loadGitHubData}
              disabled={isLoading}
              title="Refresh repositories"
              className="p-2 rounded-xl bg-[#141C28] border border-[#202B3D] text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#00D9FF]' : ''}`} />
            </button>
          </div>
        </div>

        {/* Quick Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-[#202B3D]">
          <div className="p-3 rounded-2xl bg-[#0A0F18]/80 border border-[#202B3D] flex items-center gap-3">
            <Code2 className="w-5 h-5 text-[#00D9FF]" />
            <div>
              <span className="text-xs text-slate-400 block">Total Repos</span>
              <span className="text-base font-bold text-white">{repositories.length}</span>
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-[#0A0F18]/80 border border-[#202B3D] flex items-center gap-3">
            <Database className="w-5 h-5 text-purple-400" />
            <div>
              <span className="text-xs text-slate-400 block">Indexed for RAG</span>
              <span className="text-base font-bold text-white">{indexedReposCount}</span>
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-[#0A0F18]/80 border border-[#202B3D] flex items-center gap-3">
            <Star className="w-5 h-5 text-amber-400" />
            <div>
              <span className="text-xs text-slate-400 block">Total Stars</span>
              <span className="text-base font-bold text-white">
                {repositories.reduce((acc, r) => acc + (r.stargazers_count || 0), 0)}
              </span>
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-[#0A0F18]/80 border border-[#202B3D] flex items-center gap-3">
            <Cpu className="w-5 h-5 text-emerald-400" />
            <div>
              <span className="text-xs text-slate-400 block">AI Code RAG</span>
              <span className="text-base font-bold text-emerald-400">Ready</span>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Tag Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search input */}
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search repositories by name, language or keywords..."
            className="w-full bg-[#101722] border border-[#202B3D] rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#00D9FF] transition-all"
          />
        </div>

        {/* Language Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 custom-scrollbar shrink-0">
          {uniqueLanguages.map((lang) => (
            <button
              key={lang}
              onClick={() => setSelectedTag(lang)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                selectedTag === lang
                  ? 'bg-gradient-to-r from-[#00A8FF]/20 to-[#8B5CF6]/20 text-[#00D9FF] border border-[#00D9FF]/40 shadow-[0_0_12px_rgba(0,217,255,0.2)]'
                  : 'bg-[#101722] border border-[#202B3D] text-slate-400 hover:text-white'
              }`}
            >
              {lang}
            </button>
          ))}
        </div>
      </div>

      {/* Repository Cards Grid */}
      {filteredRepos.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRepos.map((repo, idx) => {
            const isIndexed = repo.is_indexed || indexedRepos.some(ir => ir.repo_name === repo.name || ir.name === repo.name);
            return (
              <div
                key={repo.id || idx}
                className="p-4 sm:p-5 rounded-2xl bg-[#0E1622] border border-[#202B3D] hover:border-[#00D9FF]/40 transition-all flex flex-col justify-between group shadow-lg hover:shadow-[0_0_20px_rgba(0,217,255,0.1)] relative"
              >
                <div className="space-y-3">
                  {/* Top card bar: title & external link */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <FolderGit2 className="w-4 h-4 text-[#00D9FF] shrink-0" />
                      <h3 className="text-sm font-bold text-white group-hover:text-[#00D9FF] transition-colors truncate">
                        {repo.name}
                      </h3>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isIndexed && (
                        <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-[#00D9FF]/15 text-[#00D9FF] border border-[#00D9FF]/30">
                          RAG INDEXED
                        </span>
                      )}
                      {repo.html_url && (
                        <a
                          href={repo.html_url}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-[#141C28] transition-colors"
                          title="Open on GitHub"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed min-h-[32px]">
                    {repo.description || 'No description provided for this repository.'}
                  </p>

                  {/* Badges: Language, Stars, Forks */}
                  <div className="flex flex-wrap items-center gap-2 text-[10px]">
                    {repo.language && (
                      <span className={`px-2 py-0.5 rounded-lg border font-semibold ${getLanguageColor(repo.language)}`}>
                        {repo.language}
                      </span>
                    )}
                    {repo.stargazers_count !== undefined && (
                      <span className="flex items-center gap-1 text-slate-400 px-2 py-0.5 rounded-lg bg-[#0A0F18] border border-[#202B3D]">
                        <Star className="w-3 h-3 text-amber-400" />
                        {repo.stargazers_count}
                      </span>
                    )}
                    {repo.forks_count !== undefined && (
                      <span className="flex items-center gap-1 text-slate-400 px-2 py-0.5 rounded-lg bg-[#0A0F18] border border-[#202B3D]">
                        <GitFork className="w-3 h-3 text-purple-400" />
                        {repo.forks_count}
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="pt-4 mt-4 border-t border-[#202B3D] flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleExplainInChat(repo)}
                    className="flex-1 py-1.5 px-2.5 rounded-xl bg-[#141C28] hover:bg-[#1A2639] border border-[#202B3D] text-slate-200 hover:text-[#00D9FF] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#00D9FF]" />
                    Explain Repo
                  </button>

                  <button
                    onClick={() => handleIndexRepo(repo.name)}
                    disabled={indexingRepoName === repo.name}
                    className="py-1.5 px-3 rounded-xl bg-gradient-to-r from-[#00A8FF]/20 to-[#8B5CF6]/20 hover:from-[#00A8FF]/30 hover:to-[#8B5CF6]/30 border border-[#00D9FF]/40 text-[#00D9FF] text-xs font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                    title="Index code for intelligent RAG search"
                  >
                    {indexingRepoName === repo.name ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Database className="w-3.5 h-3.5" />
                    )}
                    <span>{isIndexed ? 'Re-Index' : 'Index RAG'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-8 rounded-3xl bg-[#0E1622] border border-[#202B3D] text-center space-y-3">
          <FolderGit2 className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-sm font-bold text-white">No repositories found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {searchQuery
              ? `No repositories matched "${searchQuery}". Try a different search query.`
              : 'Connect your GitHub Personal Access Token to explore and index your code repositories.'}
          </p>
          {!isConnected && (
            <button
              onClick={() => setShowConnectModal(true)}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#00A8FF] to-[#00D9FF] text-black text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 shadow"
            >
              <Key className="w-3.5 h-3.5" /> Connect GitHub Now
            </button>
          )}
        </div>
      )}

      {/* Connect GitHub Modal */}
      {showConnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-[#0E1622] border border-[#202B3D] rounded-3xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#00A8FF] to-[#8B5CF6] flex items-center justify-center text-white">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Connect GitHub Token</h3>
                  <p className="text-[11px] text-slate-400">Personal Access Token (classic or fine-grained)</p>
                </div>
              </div>
              <button
                onClick={() => setShowConnectModal(false)}
                className="text-slate-500 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConnect} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  GitHub Username (Optional)
                </label>
                <input
                  type="text"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  placeholder="e.g. octocat"
                  className="w-full bg-[#05070B] border border-[#202B3D] rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-[#00D9FF]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  GitHub Personal Access Token (PAT) *
                </label>
                <input
                  type="password"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  required
                  className="w-full bg-[#05070B] border border-[#202B3D] rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-[#00D9FF]"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Requires <code>repo</code> scope to read and index private/public code.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConnectModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#141C28] text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isConnecting || !tokenInput.trim()}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#00A8FF] to-[#00D9FF] text-black text-xs font-bold shadow disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {isConnecting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Verifying...
                    </>
                  ) : (
                    'Authenticate Token'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
