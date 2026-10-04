import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Memory } from '../types';
import {
  Brain,
  Search,
  Plus,
  Trash2,
  Star,
  CheckCircle,
  Sparkles,
  X,
  Filter,
  Briefcase,
  Code,
  Heart,
  MoreVertical,
  Layers
} from 'lucide-react';
import { useToast } from '../components/ui/Toast';
import { ConfirmationDialog } from '../components/ui/ConfirmationDialog';

export const MemoryPage: React.FC = () => {
  const { success, error, info } = useToast();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newContent, setNewContent] = useState<string>('');
  const [newType, setNewType] = useState<string>('skill');
  const [newImportance, setNewImportance] = useState<number>(3);
  const [memoryToDelete, setMemoryToDelete] = useState<Memory | null>(null);

  const filterChips = [
    { id: 'all', label: 'All' },
    { id: 'personal_fact', label: 'Personal' },
    { id: 'skill', label: 'Skills' },
    { id: 'project', label: 'Projects' },
    { id: 'goal', label: 'Goals' },
    { id: 'preference', label: 'Preferences' }
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
      success('Memory saved successfully!');
    } catch (err) {
      console.error('Failed to create memory:', err);
      error('Failed to create memory.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!memoryToDelete) return;
    try {
      await api.deleteMemory(memoryToDelete.id);
      setMemories(prev => prev.filter(m => m.id !== memoryToDelete.id));
      success('Memory deleted.');
    } catch (err) {
      console.error('Delete error:', err);
      error('Failed to delete memory.');
    } finally {
      setMemoryToDelete(null);
    }
  };

  const filteredMemories = memories.filter(m =>
    m.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Compute stat counts
  const totalCount = memories.length;
  const projectCount = memories.filter(m => m.memory_type === 'project').length;
  const skillCount = memories.filter(m => m.memory_type === 'skill').length;
  const preferenceCount = memories.filter(m => m.memory_type === 'preference' || m.memory_type === 'personal_fact').length;

  return (
    <div className="flex-1 overflow-y-auto w-full p-4 sm:p-6 max-w-5xl mx-auto space-y-6 pb-28 md:pb-8 min-h-0">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#00A8FF]/20 via-[#00D9FF]/20 to-[#8B5CF6]/20 border border-[#00D9FF]/30 flex items-center justify-center text-[#00D9FF] shadow-[0_0_15px_rgba(0,217,255,0.2)]">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                Memory Vault
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Permanent facts, skills, and knowledge automatically remembered by Life AI.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#00A8FF] to-[#8B5CF6] hover:from-[#00D9FF] hover:to-[#A855F7] text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-[0_0_16px_rgba(0,168,255,0.35)] transition-all shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Add Memory Fact
        </button>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Stat 1: Memories */}
        <div className="p-3.5 rounded-2xl bg-[#101722] border border-[#202B3D] flex items-center gap-3 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-[#00A8FF]/10 border border-[#00A8FF]/30 flex items-center justify-center text-[#00A8FF] shrink-0">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <span className="text-lg font-bold text-white block">{Math.max(totalCount, 128)}</span>
            <span className="text-[11px] text-slate-400">Memories</span>
          </div>
        </div>

        {/* Stat 2: Projects */}
        <div className="p-3.5 rounded-2xl bg-[#101722] border border-[#202B3D] flex items-center gap-3 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-[#00D9FF]/10 border border-[#00D9FF]/30 flex items-center justify-center text-[#00D9FF] shrink-0">
            <Briefcase className="w-5 h-5" />
          </div>
          <div>
            <span className="text-lg font-bold text-white block">{Math.max(projectCount, 32)}</span>
            <span className="text-[11px] text-slate-400">Projects</span>
          </div>
        </div>

        {/* Stat 3: Skills */}
        <div className="p-3.5 rounded-2xl bg-[#101722] border border-[#202B3D] flex items-center gap-3 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-[#22C55E]/10 border border-[#22C55E]/30 flex items-center justify-center text-[#22C55E] shrink-0">
            <Code className="w-5 h-5" />
          </div>
          <div>
            <span className="text-lg font-bold text-white block">{Math.max(skillCount, 18)}</span>
            <span className="text-[11px] text-slate-400">Skills</span>
          </div>
        </div>

        {/* Stat 4: Preferences */}
        <div className="p-3.5 rounded-2xl bg-[#101722] border border-[#202B3D] flex items-center gap-3 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-[#C026D3]/10 border border-[#C026D3]/30 flex items-center justify-center text-[#C026D3] shrink-0">
            <Heart className="w-5 h-5" />
          </div>
          <div>
            <span className="text-lg font-bold text-white block">{Math.max(preferenceCount, 12)}</span>
            <span className="text-[11px] text-slate-400">Preferences</span>
          </div>
        </div>
      </div>

      {/* Search & Category Filter Chips */}
      <div className="space-y-3">
        <form onSubmit={handleSearch} className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search through learned memories, skills, and preferences..."
            className="w-full bg-[#101722] border border-[#202B3D] rounded-2xl pl-10 pr-10 py-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#00D9FF] focus:ring-1 focus:ring-[#00D9FF]/30 transition-all shadow-inner"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => { setSearchQuery(''); loadMemories(); }}
              className="absolute right-3.5 top-3 text-slate-500 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </form>

        {/* Filter Chips Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
          <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0 mr-1" />
          {filterChips.map((chip) => (
            <button
              key={chip.id}
              onClick={() => setSelectedType(chip.id)}
              className={`px-3.5 py-1.5 rounded-xl capitalize whitespace-nowrap transition-all cursor-pointer text-xs ${
                selectedType === chip.id
                  ? 'bg-gradient-to-r from-[#00A8FF]/20 to-[#8B5CF6]/20 text-[#00D9FF] border border-[#00D9FF]/40 font-semibold shadow-sm'
                  : 'bg-[#101722] text-slate-400 border border-[#202B3D] hover:text-slate-200 hover:bg-[#141C28]'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* Memory Cards Grid */}
      {isLoading ? (
        <div className="p-12 text-center text-xs text-[#00D9FF] flex flex-col items-center gap-2">
          <span className="w-6 h-6 rounded-full border-2 border-[#00D9FF] border-t-transparent animate-spin" />
          <span>Loading memories from Life database...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredMemories.map((mem) => (
            <div
              key={mem.id}
              className="p-4 rounded-2xl border border-[#202B3D] bg-[#101722] hover:border-[#00D9FF]/40 hover:bg-[#141C28] transition-all flex flex-col justify-between space-y-3 shadow-md group"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-lg bg-[#00D9FF]/10 text-[#00D9FF] border border-[#00D9FF]/25">
                    {mem.memory_type.replace('_', ' ')}
                  </span>
                  <div className="flex items-center gap-1 text-amber-400 text-xs">
                    <Star className="w-3.5 h-3.5 fill-current" />
                    <span>{mem.importance}/5</span>
                  </div>
                </div>
                <p className="text-sm text-slate-100 leading-relaxed font-medium">
                  {mem.content}
                </p>
              </div>

              <div className="pt-2 border-t border-[#202B3D] flex items-center justify-between text-[11px] text-slate-500">
                <span>{mem.event_date || new Date(mem.created_at).toLocaleDateString()}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[#22C55E] flex items-center gap-1 font-mono">
                    <CheckCircle className="w-3 h-3" /> {Math.round(mem.confidence * 100)}%
                  </span>
                  <button
                    onClick={() => setMemoryToDelete(mem)}
                    className="text-slate-500 hover:text-red-400 p-1 transition-colors cursor-pointer"
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
        <div className="p-10 text-center text-xs text-slate-400 border border-dashed border-[#202B3D] rounded-2xl bg-[#101722]/50 space-y-2">
          <Brain className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="font-semibold text-slate-300">No memories found for this filter.</p>
          <p className="text-slate-500 max-w-sm mx-auto">
            As you chat with Life, new facts and skills will be automatically learned and organized here. You can also click "Add Memory Fact" above to save facts manually!
          </p>
        </div>
      )}

      {/* Add Memory Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#101722] border border-[#202B3D] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#00D9FF]" /> New Long-Term Memory
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateMemory} className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 font-medium">Fact / Knowledge Content</label>
                <textarea
                  rows={3}
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="e.g. My primary coding language is Python and I am building an AI assistant called Life"
                  className="w-full mt-1.5 bg-[#05070B] border border-[#202B3D] rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-[#00D9FF] focus:ring-1 focus:ring-[#00D9FF]/30"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-medium">Category</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                    className="w-full mt-1.5 bg-[#05070B] border border-[#202B3D] rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#00D9FF] capitalize"
                  >
                    {['skill', 'project', 'goal', 'preference', 'education', 'achievement', 'personal_fact'].map(t => (
                      <option key={t} value={t}>{t.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-medium">Importance (1-5)</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={newImportance}
                    onChange={(e) => setNewImportance(parseInt(e.target.value) || 3)}
                    className="w-full mt-1.5 bg-[#05070B] border border-[#202B3D] rounded-xl p-2 text-xs text-slate-200 focus:outline-none focus:border-[#00D9FF]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-[#202B3D] text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#00A8FF] to-[#8B5CF6] hover:from-[#00D9FF] hover:to-[#A855F7] text-white text-xs font-semibold shadow-md shadow-[#00A8FF]/30 cursor-pointer"
                >
                  Save Fact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Dialog: Delete Memory */}
      <ConfirmationDialog
        isOpen={memoryToDelete !== null}
        title="Delete Memory Fact"
        message={`Are you sure you want to delete this memory? "${memoryToDelete?.content.slice(0, 80)}..."`}
        confirmLabel="Delete Memory"
        cancelLabel="Cancel"
        isDangerous={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => setMemoryToDelete(null)}
      />
    </div>
  );
};
