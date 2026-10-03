import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Memory } from '../types';
import { Brain, Search, Plus, Trash2, Edit3, Star, CheckCircle, ShieldAlert, Sparkles } from 'lucide-react';

export const MemoryPage: React.FC = () => {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newContent, setNewContent] = useState<string>('');
  const [newType, setNewType] = useState<string>('skill');
  const [newImportance, setNewImportance] = useState<number>(3);

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
    try {
      const typeParam = selectedType === 'all' ? undefined : selectedType;
      const list = await api.getMemories({ memory_type: typeParam });
      setMemories(list);
    } catch (err) {
      console.error('Failed to load memories:', err);
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
      // Map retrieved vector items
      loadMemories();
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
      setMemories([created, ...memories]);
      setNewContent('');
      setShowAddModal(false);
    } catch (err) {
      console.error('Failed to create memory:', err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteMemory(id);
      setMemories(memories.filter(m => m.id !== id));
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const filteredMemories = memories.filter(m =>
    m.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Brain className="w-6 h-6 text-orange-400" /> Long-Term Memory
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Verified facts and knowledge automatically learned by Jeet from your daily conversations.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold flex items-center gap-2 shadow-[0_0_20px_rgba(249,115,22,0.3)] transition-all shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Add Memory
        </button>
      </div>

      {/* Search & Category Pills */}
      <div className="space-y-3">
        <form onSubmit={handleSearch} className="relative">
          <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search long-term memories..."
            className="w-full bg-[#121217] border border-gray-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors"
          />
        </form>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          {memoryTypes.map((type) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`px-3 py-1.5 rounded-lg capitalize whitespace-nowrap transition-all ${
                selectedType === type
                  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40 font-semibold'
                  : 'bg-[#14141a] text-gray-400 border border-gray-800/80 hover:text-gray-200'
              }`}
            >
              {type.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Memory Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredMemories.map((mem) => (
          <div
            key={mem.id}
            className="p-4 rounded-2xl border border-gray-800/80 bg-[#121217] hover:border-orange-500/30 transition-all flex flex-col justify-between space-y-3"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">
                  {mem.memory_type.replace('_', ' ')}
                </span>
                <div className="flex items-center gap-1 text-amber-400 text-xs">
                  <Star className="w-3.5 h-3.5 fill-current" />
                  <span>{mem.importance}/5</span>
                </div>
              </div>
              <p className="text-sm text-gray-200 leading-relaxed font-medium">{mem.content}</p>
            </div>

            <div className="pt-2 border-t border-gray-800/60 flex items-center justify-between text-[11px] text-gray-500">
              <span>{mem.event_date || new Date(mem.created_at).toLocaleDateString()}</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> {Math.round(mem.confidence * 100)}%
                </span>
                <button
                  onClick={() => handleDelete(mem.id)}
                  className="text-gray-500 hover:text-red-400 p-1 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredMemories.length === 0 && (
        <div className="p-12 text-center text-xs text-gray-500 border border-dashed border-gray-800 rounded-2xl">
          No memories found for this filter. As you chat with Jeet, memories will be learned automatically!
        </div>
      )}

      {/* Add Memory Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#14141a] border border-gray-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-orange-400" /> New Long-Term Memory
            </h3>
            <form onSubmit={handleCreateMemory} className="space-y-3">
              <div>
                <label className="text-xs text-gray-400">Content / Fact</label>
                <textarea
                  rows={3}
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="e.g. I am proficient in LangChain and ChromaDB"
                  className="w-full mt-1 bg-[#0a0a0c] border border-gray-800 rounded-xl p-3 text-xs text-gray-200 focus:outline-none focus:border-orange-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400">Memory Type</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                    className="w-full mt-1 bg-[#0a0a0c] border border-gray-800 rounded-xl p-2.5 text-xs text-gray-200 focus:outline-none focus:border-orange-500 capitalize"
                  >
                    {memoryTypes.filter(t => t !== 'all').map(t => (
                      <option key={t} value={t}>{t.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400">Importance (1-5)</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={newImportance}
                    onChange={(e) => setNewImportance(parseInt(e.target.value))}
                    className="w-full mt-1 bg-[#0a0a0c] border border-gray-800 rounded-xl p-2 text-xs text-gray-200 focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-gray-800 text-xs text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold"
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
