import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  BookMarked,
  Plus,
  Sparkles,
  Clock,
  ArrowUpRight,
  Filter,
  CheckCircle2,
  Calendar,
  History,
  Tag,
  RefreshCw
} from 'lucide-react';

export const JournalPage: React.FC = () => {
  const [entries, setEntries] = useState<any[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // New Entry Form State
  const [title, setTitle] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [category, setCategory] = useState<string>('reflection');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Weekly Reflection State
  const [weeklyReflection, setWeeklyReflection] = useState<any>(null);
  const [isLoadingWeekly, setIsLoadingWeekly] = useState<boolean>(false);
  const [showWeeklyModal, setShowWeeklyModal] = useState<boolean>(false);

  // Notification / Feedback
  const [feedbackMsg, setFeedbackMsg] = useState<string>('');

  useEffect(() => {
    loadJournalEntries();
  }, [categoryFilter]);

  const loadJournalEntries = async () => {
    setIsLoading(true);
    try {
      const data = await api.getJournalEntries(categoryFilter || undefined);
      setEntries(data || []);
    } catch (err) {
      console.error('Failed to load journal entries:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await api.createJournalEntry({
        title: title.trim() || undefined,
        content: content.trim(),
        category
      });
      setTitle('');
      setContent('');
      setFeedbackMsg('Journal entry logged successfully!');
      setTimeout(() => setFeedbackMsg(''), 4000);
      await loadJournalEntries();
    } catch (err) {
      console.error('Error logging journal entry:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePromoteEntry = async (id: string) => {
    try {
      const res = await api.promoteJournalEntry(id);
      setFeedbackMsg(`Promoted to permanent memory! (ID: ${res.memory_id || 'saved'})`);
      setTimeout(() => setFeedbackMsg(''), 4000);
      await loadJournalEntries();
    } catch (err) {
      console.error('Failed to promote entry:', err);
    }
  };

  const handleFetchWeeklyReflection = async () => {
    setIsLoadingWeekly(true);
    setShowWeeklyModal(true);
    try {
      const res = await api.getWeeklyReflection();
      setWeeklyReflection(res);
    } catch (err) {
      console.error('Failed to get weekly reflection:', err);
    } finally {
      setIsLoadingWeekly(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#202B3D] pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-tr from-[#00A8FF]/20 to-[#8B5CF6]/20 border border-[#00D9FF]/40 text-[#00D9FF]">
            <BookMarked className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Personal Journal & Time Machine</h1>
            <p className="text-sm text-slate-400">Log deliberate reflections, review weekly evolutions, and promote insights to permanent memory</p>
          </div>
        </div>

        <button
          onClick={handleFetchWeeklyReflection}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#141C2B] hover:bg-[#1E293B] border border-[#202B3D] text-slate-200 hover:text-white text-sm font-semibold transition-all"
        >
          <History className="w-4 h-4 text-[#00D9FF]" />
          <span>7-Day Weekly Retrospective</span>
        </button>
      </div>

      {feedbackMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-sm flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* Main Grid: Form on left, Entries list on right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create Reflection Card */}
        <div className="p-6 rounded-2xl bg-[#0D131F] border border-[#202B3D] space-y-4 h-fit">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Plus className="w-4 h-4 text-[#00D9FF]" />
            <span>New Reflection Log</span>
          </h2>

          <form onSubmit={handleCreateEntry} className="space-y-4 text-xs">
            <div>
              <label className="block font-medium text-slate-300 mb-1">Title (Optional)</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Milestone breakthrough on vector RAG"
                className="w-full px-3 py-2.5 rounded-xl bg-[#141C2B] border border-[#202B3D] text-white focus:outline-none focus:border-[#00D9FF]"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-300 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-[#141C2B] border border-[#202B3D] text-white focus:outline-none focus:border-[#00D9FF]"
              >
                <option value="reflection">Reflection</option>
                <option value="decision_log">Decision Log</option>
                <option value="insight">Key Insight</option>
                <option value="private_journal">Private Diary Entry</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-300 mb-1">Reflection Content *</label>
              <textarea
                rows={5}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="What did you learn today? What trade-offs were made? Any realizations?"
                className="w-full px-3 py-2.5 rounded-xl bg-[#141C2B] border border-[#202B3D] text-white focus:outline-none focus:border-[#00D9FF] resize-none"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !content.trim()}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#00A8FF] to-[#8B5CF6] text-white font-semibold hover:opacity-90 transition-opacity shadow-[0_0_15px_rgba(0,217,255,0.25)] flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>Save Reflection</span>
            </button>
          </form>
        </div>

        {/* Entries List */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filters Bar */}
          <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#0D131F] border border-[#202B3D] text-xs">
            <div className="flex items-center gap-2 text-slate-400">
              <Filter className="w-3.5 h-3.5" />
              <span>Filter:</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {['', 'reflection', 'decision_log', 'insight', 'private_journal'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-2.5 py-1 rounded-lg transition-all capitalize ${
                    categoryFilter === cat
                      ? 'bg-[#00D9FF]/20 text-[#00D9FF] border border-[#00D9FF]/40 font-semibold'
                      : 'text-slate-400 hover:text-white bg-[#141C2B]'
                  }`}
                >
                  {cat || 'All'}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="py-20 flex justify-center">
              <RefreshCw className="w-8 h-8 text-[#00D9FF] animate-spin" />
            </div>
          ) : entries.length ? (
            <div className="space-y-3">
              {entries.map((item) => (
                <div
                  key={item.id}
                  className="p-5 rounded-2xl bg-[#0D131F] border border-[#202B3D] space-y-3 hover:border-[#2A384F] transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-white">{item.title || 'Journal Entry'}</h3>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-[#00D9FF]" />
                          {item.entry_date}
                        </span>
                        <span>•</span>
                        <span className="px-2 py-0.5 rounded bg-[#141C2B] text-slate-300 uppercase tracking-wider text-[10px]">
                          {item.category}
                        </span>
                      </div>
                    </div>

                    {/* Promote to Memory Button */}
                    {item.promoted_to_memory ? (
                      <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-medium shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Promoted to Memory
                      </span>
                    ) : (
                      <button
                        onClick={() => handlePromoteEntry(item.id)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#141C2B] hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-300 border border-[#202B3D] hover:border-emerald-500/40 text-xs font-medium transition-all shrink-0"
                      >
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        Promote to Memory
                      </button>
                    )}
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {item.content}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 rounded-2xl bg-[#0D131F] border border-[#202B3D] text-center text-slate-400 text-sm">
              No journal reflections found in this category. Write your first reflection to seed your personal timeline!
            </div>
          )}
        </div>
      </div>

      {/* Weekly Reflection Modal / Slide-in */}
      {showWeeklyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="p-6 rounded-2xl bg-[#0D131F] border border-[#202B3D] max-w-2xl w-full max-h-[85vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b border-[#202B3D] pb-3">
              <div className="flex items-center gap-2 text-white font-semibold">
                <History className="w-5 h-5 text-[#00D9FF]" />
                <span>7-Day Retrospective Evolution</span>
              </div>
              <button
                onClick={() => setShowWeeklyModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕ Close
              </button>
            </div>

            {isLoadingWeekly ? (
              <div className="py-12 flex justify-center">
                <RefreshCw className="w-8 h-8 text-[#00D9FF] animate-spin" />
              </div>
            ) : weeklyReflection?.formatted_response ? (
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 font-mono whitespace-pre-wrap leading-relaxed">
                {weeklyReflection.formatted_response}
              </div>
            ) : (
              <p className="text-slate-400 text-xs">No retrospective data available for the past 7 days.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
