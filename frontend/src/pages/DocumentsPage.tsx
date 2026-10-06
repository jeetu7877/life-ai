import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Document } from '../types';
import { useToast } from '../components/ui/Toast';
import { ConfirmationDialog } from '../components/ui/ConfirmationDialog';
import {
  FileText,
  UploadCloud,
  Trash2,
  RefreshCw,
  Eye,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  MessageSquare,
  Search
} from 'lucide-react';

export const DocumentsPage: React.FC = () => {
  const navigate = useNavigate();
  const { success, error, info } = useToast();

  const [documents, setDocuments] = useState<Document[]>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [docToDelete, setDocToDelete] = useState<Document | null>(null);
  const [searchFilter, setSearchFilter] = useState<string>('');

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      const list = await api.getDocuments();
      setDocuments(list);
    } catch (err) {
      console.error('Failed to load documents:', err);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const formData = new FormData();
    for (let i = 0; i < e.target.files.length; i++) {
      formData.append('files', e.target.files[i]);
    }

    setIsUploading(true);
    info('Uploading document and initiating OCR pipeline...');
    try {
      await api.uploadDocuments(formData);
      await loadDocuments();
      success('Document uploaded and queued for indexing!');
    } catch (err: any) {
      console.error('Upload failed:', err);
      error(err.response?.data?.detail || 'Document upload failed.');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleConfirmDelete = async () => {
    if (!docToDelete) return;
    try {
      await api.deleteDocument(docToDelete.id);
      setDocuments((prev) => prev.filter((d) => d.id !== docToDelete.id));
      if (selectedDoc?.id === docToDelete.id) setSelectedDoc(null);
      success(`'${docToDelete.original_filename}' deleted from knowledge vault.`);
    } catch (err) {
      console.error('Delete document failed:', err);
      error('Failed to delete document.');
    } finally {
      setDocToDelete(null);
    }
  };

  const handleReprocess = async (id: string) => {
    info('Reprocessing document OCR and embeddings...');
    try {
      const updated = await api.reprocessDocument(id);
      setDocuments((prev) => prev.map((d) => (d.id === id ? updated : d)));
      success('Document reprocessed successfully.');
    } catch (err) {
      console.error('Reprocess failed:', err);
      error('Reprocess failed.');
    }
  };

  const handleAskAboutDoc = (doc: Document) => {
    // Navigate to chat and ask Life about this document
    navigate('/chat');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" /> Ready
          </span>
        );
      case 'ocr_processing':
      case 'embedding':
      case 'pending':
        return (
          <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Loader2 className="w-3 h-3 animate-spin" /> Processing
          </span>
        );
      case 'failed':
      default:
        return (
          <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
            <AlertCircle className="w-3 h-3" /> Failed
          </span>
        );
    }
  };

  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const categoryPills = ['All', 'Resume', 'Notes', 'IDs', 'Others'];

  const filteredDocs = documents.filter((d) => {
    const matchesSearch =
      d.original_filename.toLowerCase().includes(searchFilter.toLowerCase()) ||
      d.category.toLowerCase().includes(searchFilter.toLowerCase());
    if (!matchesSearch) return false;

    if (selectedCategory === 'All') return true;
    if (selectedCategory === 'Resume') return d.category.toLowerCase().includes('resume') || d.original_filename.toLowerCase().includes('resume') || d.original_filename.toLowerCase().includes('cv');
    if (selectedCategory === 'Notes') return d.category.toLowerCase().includes('note') || d.original_filename.toLowerCase().includes('note');
    if (selectedCategory === 'IDs') return d.category.toLowerCase().includes('id') || d.category.toLowerCase().includes('identity') || d.original_filename.toLowerCase().includes('id') || d.original_filename.toLowerCase().includes('pan') || d.original_filename.toLowerCase().includes('aadhaar');
    return !['resume', 'note', 'id', 'identity'].some(k => d.category.toLowerCase().includes(k) || d.original_filename.toLowerCase().includes(k));
  });

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-6xl mx-auto space-y-6 pb-28 md:pb-8 min-h-0">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <FileText className="w-6 h-6 text-[#00D9FF]" /> Personal Documents & Knowledge
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Upload resumes, ID cards, certificates, and marksheets. Life AI extracts knowledge and indexes them into ChromaDB for instant recall.
        </p>
      </div>

      {/* Upload Drop Zone */}
      <div className="p-8 border-2 border-dashed border-[#202B3D] hover:border-[#00D9FF]/50 rounded-2xl bg-[#0A0F18]/60 flex flex-col items-center justify-center text-center space-y-3 transition-colors relative">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#00A8FF]/20 to-[#8B5CF6]/20 flex items-center justify-center text-[#00D9FF]">
          <UploadCloud className="w-6 h-6" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-slate-200">Upload Identity or Academic Documents</h4>
          <p className="text-xs text-slate-400 mt-1">PDF, PNG, JPG (e.g. Aadhaar, PAN, College ID, Marksheet, Resume)</p>
        </div>
        <label className="cursor-pointer px-4 py-2 rounded-xl bg-gradient-to-r from-[#00A8FF] to-[#8B5CF6] hover:from-[#00D9FF] hover:to-[#A855F7] text-white text-xs font-semibold shadow-lg shadow-[#00A8FF]/20 transition-all">
          {isUploading ? 'Extracting & Indexing...' : 'Browse Documents'}
          <input
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg"
            onChange={handleFileUpload}
            disabled={isUploading}
            className="hidden"
          />
        </label>
      </div>

      {/* Search Filter & Category Pills (Screen 5) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 bg-[#0A0F18] border border-[#202B3D] rounded-xl px-3.5 py-2 flex-1 min-w-0">
          <Search className="w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Search documents by filename or category..."
            className="bg-transparent border-none text-xs text-slate-200 focus:outline-none w-full"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 custom-scrollbar shrink-0">
          {categoryPills.map((cat) => (
            <button
              key={cat}
              type="button"
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

      {/* Document Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDocs.map((doc) => (
          <div
            key={doc.id}
            className="p-4 rounded-2xl border border-[#202B3D] bg-[#101722] hover:border-[#00D9FF]/40 transition-all flex flex-col justify-between space-y-3 group shadow-sm"
          >
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 truncate">
                  <div className="w-8 h-8 rounded-xl bg-[#0A0F18] border border-[#202B3D] flex items-center justify-center text-[#00D9FF] shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs font-bold text-slate-200 truncate">{doc.original_filename}</h3>
                </div>
                {getStatusBadge(doc.extraction_status)}
              </div>

              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                <span className="px-2 py-0.5 rounded-md bg-[#0A0F18] border border-[#202B3D] uppercase tracking-wider font-semibold text-[#00D9FF]">
                  {doc.category.replace('_', ' ')}
                </span>
                <span>{(doc.file_size / 1024).toFixed(1)} KB</span>
              </div>
            </div>

            <div className="pt-2 border-t border-[#1C283B] flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedDoc(doc)}
                  className="text-[#00D9FF] hover:text-[#00A8FF] flex items-center gap-1 font-medium cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" /> View
                </button>
                <button
                  type="button"
                  onClick={() => handleAskAboutDoc(doc)}
                  className="text-slate-400 hover:text-white flex items-center gap-1 font-medium cursor-pointer"
                  title="Ask questions in chat"
                >
                  <MessageSquare className="w-3.5 h-3.5" /> Ask
                </button>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleReprocess(doc.id)}
                  title="Reprocess OCR"
                  className="p-1.5 text-slate-400 hover:text-[#00D9FF] transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setDocToDelete(doc)}
                  title="Delete Document"
                  className="p-1.5 text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {documents.length === 0 && (
        <div className="p-8 text-center text-xs text-slate-500">
          No documents uploaded yet. Upload your college ID, resume, or certificates to let Life AI answer your questions accurately.
        </div>
      )}

      {/* Extracted Detail Drawer / Modal */}
      {selectedDoc && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#101722] border border-[#202B3D] rounded-2xl max-w-2xl w-full p-6 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#202B3D] pb-3">
              <div>
                <h3 className="text-base font-bold text-white">{selectedDoc.original_filename}</h3>
                <span className="text-xs text-[#00D9FF] uppercase font-semibold">
                  Category: {selectedDoc.category.replace('_', ' ')}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDoc(null)}
                className="text-slate-400 hover:text-white text-xs px-2.5 py-1 rounded-xl border border-[#202B3D] cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
              {selectedDoc.structured_fields && Object.keys(selectedDoc.structured_fields).length > 0 && (
                <div className="p-3 rounded-xl bg-[#00D9FF]/10 border border-[#00D9FF]/20 space-y-1">
                  <span className="font-semibold text-[#00D9FF] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> Extracted Identity Fields:
                  </span>
                  <pre className="text-slate-200 whitespace-pre-wrap font-mono text-[11px] overflow-x-auto">
                    {JSON.stringify(selectedDoc.structured_fields, null, 2)}
                  </pre>
                </div>
              )}

              <div>
                <span className="font-semibold text-slate-400">Extracted Content Preview:</span>
                <p className="mt-1 p-3 rounded-xl bg-[#05070B] border border-[#202B3D] text-slate-300 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto font-mono text-[11px]">
                  {selectedDoc.extracted_text || 'No text extracted.'}
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-[#202B3D] flex justify-between items-center">
              <button
                type="button"
                onClick={() => {
                  setSelectedDoc(null);
                  handleAskAboutDoc(selectedDoc);
                }}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#00A8FF] to-[#00D9FF] text-black text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5" /> Ask Life About This Document
              </button>
              <button
                type="button"
                onClick={() => setSelectedDoc(null)}
                className="px-4 py-2 rounded-xl border border-[#202B3D] bg-[#141C28] text-xs font-semibold text-slate-300 cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog: Delete Document */}
      <ConfirmationDialog
        isOpen={docToDelete !== null}
        title="Delete Document"
        message={`Are you sure you want to permanently delete '${docToDelete?.original_filename}'? Extracted knowledge and vector chunks in ChromaDB will also be purged.`}
        confirmLabel="Delete Document"
        cancelLabel="Cancel"
        isDangerous={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDocToDelete(null)}
      />
    </div>
  );
};
