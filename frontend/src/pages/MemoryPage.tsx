import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Memory } from '../types';
import { Brain, Search, Plus, Trash2, Star, CheckCircle, Sparkles, X, Filter } from 'lucide-react';

export const MemoryPage: React.FC = () => {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newContent, setNewContent] = useState<string>('');
  const [newType, setNewType] = useState<string>('skill');
  const [newImportance, setNewImportance] = useState<number>(3);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const memoryTypes = [
    'all',
    'skill',
    'project',
    'goal',
    'preference',
    'education',
    'achievement',
    'activity',
    'personal_fact'
  ];

  useEffect(() => {
    loadMemories();
  }, [selectedType]);

  const loadMemories = async () => {
    setIsLoading(true);
    try {
      const typeParam = selectedType === 'all' ? undefined : selectedType;
      const list = await api.getMemories({ memory_type: typeParam });
      if (Array.isArray(list)) {
        setMemories(list);
      } else {
        setMemories([]);
      }
    } catch (err) {
      console.error('Failed to load memories:', err);
      setMemories([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      loadMemories();
      return;
    }
    try {
      const res = await api.searchMemories(searchQuery);
      if (Array.isArray(res)) {
        setMemories(res);
      }
    } catch (err) {
      console.error('Search error:', err);
    }
  };

  const handleCreateMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim()) return;

    try {
      const created = await api.createMemory({
        content: newContent.trim(),
        memory_type: newType,
        importance: newImportance,
        confidence: 1.0
      });
      setMemories(prev => [created, ...prev]);
      setNewContent('');
      setShowAddModal(false);
      showFeedback('Memory saved successfully!');
    } catch (err) {
      console.error('Failed to create memory:', err);
      showFeedback('Failed to create memory.');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteMemory(id);
      setMemories(prev => prev.filter(m => m.id !== id));
      showFeedback('Memory deleted.');
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const showFeedback = (msg: string) => {
    setActionFeedback(msg);
    setTimeout(() => setActionFeedback(null), 3000);
  };

  const filteredMemories = memories.filter(m =>
    m.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-y-auto w-full p-4 sm:p-6 max-w-6xl mx-auto space-y-6 pb-24 md:pb-8 min-h-0">
      {/* Feedback Toast */}
      {actionFeedback && (
        <div className="fixed top-20 right-6 z-50 p-3 rounded-xl bg-orange-500 text-white text-xs font-semibold shadow-lg shadow-orange-500/30 flex items-center gap-2">
          <Sparkles className="w-4 h-4" /> {actionFeedback}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                Long-Term Memory Vault
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/30 font-semibold">
                  {memories.length} Facts Saved
                </span>
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Verified facts, skills, and personal knowledge automatically learned by Life during conversations.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(249,115,22,0.3)] transition-all shrink-0 cursor-pointer border border-orange-400/30"
        >
          <Plus className="w-4 h-4" /> Add Memory Fact
        </button>
      </div>

      {/* Search & Category Filter Pills */}
      <div className="space-y-3">
        <form onSubmit={handleSearch} className="relative">
          <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search through learned memories & skills..."
            className="w-full bg-[#121218] border border-white/[0.08] rounded-xl pl-10 pr-10 py-2.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-all shadow-inner"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => { setSearchQuery(''); loadMemories(); }}
              className="absolute right-3 top-2.5 text-gray-500 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </form>

        {/* Categories Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
          <Filter className="w-3.5 h-3.5 text-gray-500 shrink-0 mr-1" />
          {memoryTypes.map((type) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`px-3 py-1.5 rounded-lg capitalize whitespace-nowrap transition-all cursor-pointer text-xs ${
                selectedType === type
                  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40 font-semibold shadow-sm'
                  : 'bg-[#14141d] text-gray-400 border border-white/[0.06] hover:text-gray-200 hover:bg-[#1a1a24]'
              }`}
            >
              {type.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Memory Cards Grid */}
      {isLoading ? (
        <div className="p-12 text-center text-xs text-orange-400 flex flex-col items-center gap-2">
          <span className="w-5 h-5 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
          <span>Loading memories from Life database...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredMemories.map((mem) => (
            <div
              key={mem.id}
              className="p-4 rounded-2xl border border-white/[0.08] bg-[#121218]/90 hover:border-orange-500/35 transition-all flex flex-col justify-between space-y-3 shadow-md shadow-black/20 group"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/25">
                    {mem.memory_type.replace('_', ' ')}
                  </span>
                  <div className="flex items-center gap-1 text-amber-400 text-xs">
                    <Star className="w-3.5 h-3.5 fill-current" />
                    <span>{mem.importance}/5</span>
                  </div>
                </div>
                <p className="text-sm text-gray-200 leading-relaxed font-medium">
                  {mem.content}
                </p>
              </div>

              <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-gray-500">
                <span>{mem.event_date || new Date(mem.created_at).toLocaleDateString()}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
                    <CheckCircle className="w-3 h-3" /> {Math.round(mem.confidence * 100)}%
                  </span>
                  <button
                    onClick={() => handleDelete(mem.id)}
                    className="text-gray-500 hover:text-red-400 p-1 transition-colors cursor-pointer"
                    title="Delete memory"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredMemories.length === 0 && (
        <div className="p-10 text-center text-xs text-gray-400 border border-dashed border-white/[0.1] rounded-2xl bg-[#121218]/40 space-y-2">
          <Brain className="w-8 h-8 text-gray-600 mx-auto" />
          <p className="font-semibold text-gray-300">No memories found for this filter.</p>
          <p className="text-gray-500 max-w-sm mx-auto">
            As you chat with Life, new facts and skills will be automatically learned and organized here. You can also click "Add Memory Fact" above to save facts manually!
          </p>
        </div>
      )}

      {/* Add Memory Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#14141c] border border-white/[0.12] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-orange-400" /> New Long-Term Memory
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateMemory} className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 font-medium">Fact / Knowledge Content</label>
                <textarea
                  rows={3}
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="e.g. My primary coding language is Python and I am building an AI assistant called Life"
                  className="w-full mt-1.5 bg-[#0a0a0f] border border-white/[0.1] rounded-xl p-3 text-xs text-gray-200 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 font-medium">Category</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                    className="w-full mt-1.5 bg-[#0a0a0f] border border-white/[0.1] rounded-xl p-2.5 text-xs text-gray-200 focus:outline-none focus:border-orange-500 capitalize"
                  >
                    {memoryTypes.filter(t => t !== 'all').map(t => (
                      <option key={t} value={t}>{t.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-medium">Importance (1-5)</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={newImportance}
                    onChange={(e) => setNewImportance(parseInt(e.target.value) || 3)}
                    className="w-full mt-1.5 bg-[#0a0a0f] border border-white/[0.1] rounded-xl p-2 text-xs text-gray-200 focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-white/[0.1] text-xs text-gray-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white text-xs font-semibold shadow-md shadow-orange-600/30 cursor-pointer"
                >
                  Save Fact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
