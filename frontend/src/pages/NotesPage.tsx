import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/ui/Toast';
import {
  BookMarked,
  Plus,
  Search,
  Pin,
  Trash2,
  Copy,
  Check,
  Sparkles,
  Tag,
  Edit2,
  Share2,
  Brain,
  FileText,
  Clock,
  Layers
} from 'lucide-react';

interface NoteItem {
  id: string;
  title: string;
  content: string;
  category: 'Ideas' | 'Study' | 'Work' | 'Personal';
  isPinned: boolean;
  tags: string[];
  updatedAt: string;
}

const DEFAULT_NOTES: NoteItem[] = [
  {
    id: 'note-1',
    title: 'Autonomous Multi-Agent Architecture',
    content: 'Key insights on agent communication: 1. Keep agent roles strictly partitioned. 2. Use a central coordinator router for intent parsing. 3. Cache frequent tool responses in Redis/Memory.',
    category: 'Work',
    isPinned: true,
    tags: ['Architecture', 'AI', 'Agents'],
    updatedAt: new Date().toISOString()
  },
  {
    id: 'note-2',
    title: 'Spaced Repetition & Cognitive Mastery',
    content: 'Review interval formula: 1 day, 3 days, 7 days, 16 days, 35 days. Active recall via Socratic questioning dramatically outperforms passive re-reading.',
    category: 'Study',
    isPinned: true,
    tags: ['Learning', 'Flashcards'],
    updatedAt: new Date(Date.now() - 86400000).toISOString()
  },
  {
    id: 'note-3',
    title: 'Voice Engine Latency Optimization',
    content: 'Achieve sub-300ms voice response: Stream audio buffer directly while LLM tokens are generating. Do not wait for complete sentence if punctuation boundaries are reached.',
    category: 'Ideas',
    isPinned: false,
    tags: ['Voice', 'Latency', 'Audio'],
    updatedAt: new Date(Date.now() - 86400000 * 2).toISOString()
  },
  {
    id: 'note-4',
    title: 'Daily Deep Work Routine',
    content: 'Block 8:00 AM - 11:30 AM for undisturbed engineering flow. Notifications muted, music player in lo-fi focus playlist mode.',
    category: 'Personal',
    isPinned: false,
    tags: ['Productivity', 'Habits'],
    updatedAt: new Date(Date.now() - 86400000 * 3).toISOString()
  }
];

export const NotesPage: React.FC = () => {
  const navigate = useNavigate();
  const { success, error, info } = useToast();

  const [notes, setNotes] = useState<NoteItem[]>(() => {
    try {
      const saved = localStorage.getItem('life_ai_notes');
      return saved ? JSON.parse(saved) : DEFAULT_NOTES;
    } catch {
      return DEFAULT_NOTES;
    }
  });

  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal State
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingNote, setEditingNote] = useState<NoteItem | null>(null);
  const [noteTitle, setNoteTitle] = useState<string>('');
  const [noteContent, setNoteContent] = useState<string>('');
  const [noteCategory, setNoteCategory] = useState<'Ideas' | 'Study' | 'Work' | 'Personal'>('Ideas');
  const [noteTags, setNoteTags] = useState<string>('');
  const [notePinned, setNotePinned] = useState<boolean>(false);

  useEffect(() => {
    localStorage.setItem('life_ai_notes', JSON.stringify(notes));
  }, [notes]);

  const categories = ['All', 'Pinned', 'Ideas', 'Study', 'Work', 'Personal'];

  const handleOpenCreateModal = () => {
    setEditingNote(null);
    setNoteTitle('');
    setNoteContent('');
    setNoteCategory('Ideas');
    setNoteTags('');
    setNotePinned(false);
    setShowModal(true);
  };

  const handleOpenEditModal = (note: NoteItem) => {
    setEditingNote(note);
    setNoteTitle(note.title);
    setNoteContent(note.content);
    setNoteCategory(note.category);
    setNoteTags(note.tags.join(', '));
    setNotePinned(note.isPinned);
    setShowModal(true);
  };

  const handleSaveNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim()) return;

    const tagsArray = noteTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    if (editingNote) {
      setNotes((prev) =>
        prev.map((n) =>
          n.id === editingNote.id
            ? {
                ...n,
                title: noteTitle.trim(),
                content: noteContent.trim(),
                category: noteCategory,
                isPinned: notePinned,
                tags: tagsArray,
                updatedAt: new Date().toISOString()
              }
            : n
        )
      );
      success('Note updated successfully!');
    } else {
      const newNote: NoteItem = {
        id: `note-${Date.now()}`,
        title: noteTitle.trim(),
        content: noteContent.trim(),
        category: noteCategory,
        isPinned: notePinned,
        tags: tagsArray,
        updatedAt: new Date().toISOString()
      };
      setNotes((prev) => [newNote, ...prev]);
      success('New note created!');
    }

    setShowModal(false);
  };

  const handleDeleteNote = (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    success('Note deleted.');
  };

  const handleTogglePin = (id: string) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isPinned: !n.isPinned } : n))
    );
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleAISummarize = () => {
    const summaryPrompt = `Summarize and identify key takeaways from these personal notes:\n\n${notes
      .map((n) => `- [${n.title}]: ${n.content}`)
      .join('\n')}`;
    navigate('/chat', { state: { initialQuery: summaryPrompt } });
  };

  const handleGenerateFlashcards = () => {
    const studyNotes = notes.filter((n) => n.category === 'Study' || n.category === 'Ideas');
    const flashcardPrompt = `Generate a set of 5 active recall flashcards (Question & Answer) based on these notes:\n\n${(studyNotes.length > 0 ? studyNotes : notes)
      .map((n) => `- ${n.title}: ${n.content}`)
      .join('\n')}`;
    navigate('/chat', { state: { initialQuery: flashcardPrompt } });
  };

  // Filter notes
  const filteredNotes = notes.filter((note) => {
    const matchesSearch =
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (selectedCategory === 'All') return true;
    if (selectedCategory === 'Pinned') return note.isPinned;
    return note.category === selectedCategory;
  });

  return (
    <div className="flex-1 overflow-y-auto w-full p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6 pb-28 md:pb-8 min-h-0 select-none custom-scrollbar">
      {/* Header Banner */}
      <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-[#0E1622] to-[#111B29] border border-[#202B3D] shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#00D9FF]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#05070B] border border-[#00D9FF]/40 flex items-center justify-center text-[#00D9FF] shadow-[0_0_20px_rgba(0,217,255,0.2)]">
              <BookMarked className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Smart Notes & Flashcards</h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/15 text-[#00D9FF] border border-[#00D9FF]/30">
                  {notes.length} Notes
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Capture thoughts, distill knowledge and convert notes into AI study flashcards.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleOpenCreateModal}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#00A8FF] to-[#8B5CF6] hover:from-[#00D9FF] hover:to-[#A855F7] text-white text-xs font-semibold flex items-center gap-1.5 shadow-[0_0_15px_rgba(0,168,255,0.3)] transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              New Note
            </button>
          </div>
        </div>

        {/* AI Action Accelerators */}
        <div className="flex flex-wrap items-center gap-2.5 mt-5 pt-5 border-t border-[#202B3D]">
          <button
            onClick={handleAISummarize}
            className="px-3 py-1.5 rounded-xl bg-[#141C28] hover:bg-[#1A2639] border border-[#202B3D] text-slate-200 hover:text-[#00D9FF] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#00D9FF]" />
            AI Summarize All
          </button>
          <button
            onClick={handleGenerateFlashcards}
            className="px-3 py-1.5 rounded-xl bg-[#141C28] hover:bg-[#1A2639] border border-[#202B3D] text-slate-200 hover:text-emerald-400 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Brain className="w-3.5 h-3.5 text-emerald-400" />
            Generate Flashcards
          </button>
          <button
            onClick={() => navigate('/documents')}
            className="px-3 py-1.5 rounded-xl bg-[#141C28] hover:bg-[#1A2639] border border-[#202B3D] text-slate-200 hover:text-purple-400 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-purple-400" />
            Sync to Documents RAG
          </button>
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
            placeholder="Search notes by title, content or tags..."
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

      {/* Notes Grid */}
      {filteredNotes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredNotes.map((note) => (
            <div
              key={note.id}
              className={`p-5 rounded-2xl bg-[#0E1622] border transition-all flex flex-col justify-between group shadow-lg ${
                note.isPinned
                  ? 'border-[#00D9FF]/40 shadow-[0_0_20px_rgba(0,217,255,0.1)]'
                  : 'border-[#202B3D] hover:border-[#00D9FF]/30'
              }`}
            >
              <div className="space-y-3">
                {/* Top card bar */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#00D9FF] px-2 py-0.5 rounded bg-[#00D9FF]/10 border border-[#00D9FF]/20">
                      {note.category}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleTogglePin(note.id)}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                        note.isPinned
                          ? 'text-[#00D9FF] bg-[#00D9FF]/15'
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                      title={note.isPinned ? 'Unpin' : 'Pin to top'}
                    >
                      <Pin className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleCopy(`${note.title}\n\n${note.content}`, note.id)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-white transition-colors cursor-pointer"
                      title="Copy note"
                    >
                      {copiedId === note.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Title */}
                <h3 className="text-sm font-bold text-white group-hover:text-[#00D9FF] transition-colors leading-snug">
                  {note.title}
                </h3>

                {/* Content snippet */}
                <p className="text-xs text-slate-300 line-clamp-4 leading-relaxed font-normal whitespace-pre-wrap">
                  {note.content}
                </p>

                {/* Tags */}
                {note.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {note.tags.map((t, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] text-slate-400 bg-[#05070B] border border-[#202B3D] px-2 py-0.5 rounded-md flex items-center gap-1"
                      >
                        <Tag className="w-2.5 h-2.5 text-slate-500" />
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Bottom Actions */}
              <div className="pt-4 mt-4 border-t border-[#202B3D] flex items-center justify-between text-slate-400 text-[10px]">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-500" />
                  {new Date(note.updatedAt).toLocaleDateString()}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenEditModal(note)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-[#00D9FF] hover:bg-[#141C28] transition-colors cursor-pointer"
                    title="Edit Note"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteNote(note.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-[#141C28] transition-colors cursor-pointer"
                    title="Delete Note"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-8 rounded-3xl bg-[#0E1622] border border-[#202B3D] text-center space-y-3">
          <BookMarked className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-sm font-bold text-white">No notes found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {searchQuery
              ? `No notes matching "${searchQuery}".`
              : 'Start your personal knowledge vault by capturing your first note.'}
          </p>
          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#00A8FF] to-[#00D9FF] text-black text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 shadow"
          >
            <Plus className="w-3.5 h-3.5" /> Create Note
          </button>
        </div>
      )}

      {/* Note Editor Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg bg-[#0E1622] border border-[#202B3D] rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                {editingNote ? 'Edit Note' : 'Create New Note'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-500 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveNote} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  placeholder="Note title"
                  required
                  className="w-full bg-[#05070B] border border-[#202B3D] rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-[#00D9FF]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Category
                  </label>
                  <select
                    value={noteCategory}
                    onChange={(e) => setNoteCategory(e.target.value as any)}
                    className="w-full bg-[#05070B] border border-[#202B3D] rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-[#00D9FF]"
                  >
                    <option value="Ideas">Ideas</option>
                    <option value="Study">Study</option>
                    <option value="Work">Work</option>
                    <option value="Personal">Personal</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Tags (comma separated)
                  </label>
                  <input
                    type="text"
                    value={noteTags}
                    onChange={(e) => setNoteTags(e.target.value)}
                    placeholder="AI, Study, Brain"
                    className="w-full bg-[#05070B] border border-[#202B3D] rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-[#00D9FF]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Content
                </label>
                <textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Write your thoughts, code snippets, study key-points..."
                  rows={6}
                  className="w-full bg-[#05070B] border border-[#202B3D] rounded-xl p-3.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-[#00D9FF] resize-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="notePinned"
                  checked={notePinned}
                  onChange={(e) => setNotePinned(e.target.checked)}
                  className="w-4 h-4 rounded border-[#202B3D] bg-[#05070B] text-[#00D9FF] focus:ring-0 cursor-pointer"
                />
                <label htmlFor="notePinned" className="text-xs text-slate-300 cursor-pointer select-none">
                  Pin to top of knowledge notes
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#141C28] text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#00A8FF] to-[#00D9FF] text-black text-xs font-bold shadow cursor-pointer"
                >
                  Save Note
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
