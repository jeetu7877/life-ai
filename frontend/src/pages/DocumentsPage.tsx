import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Document } from '../types';
import { FileText, UploadCloud, Trash2, RefreshCw, Eye, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export const DocumentsPage: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);

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
    try {
      await api.uploadDocuments(formData);
      await loadDocuments();
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteDocument(id);
      setDocuments(documents.filter(d => d.id !== id));
      if (selectedDoc?.id === id) setSelectedDoc(null);
    } catch (err) {
      console.error('Delete document failed:', err);
    }
  };

  const handleReprocess = async (id: string) => {
    try {
      const updated = await api.reprocessDocument(id);
      setDocuments(documents.map(d => (d.id === id ? updated : d)));
    } catch (err) {
      console.error('Reprocess failed:', err);
    }
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

  return (
    <div className="flex-1 p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <FileText className="w-6 h-6 text-orange-400" /> Personal Documents & Knowledge
        </h2>
        <p className="text-xs text-gray-400 mt-1">
          Upload resumes, ID cards, certificates, and project notes once. Jeet extracts knowledge and indexes them into ChromaDB for instant recall.
        </p>
      </div>

      {/* Drag & Drop Upload Card */}
      <div className="border-2 border-dashed border-gray-800 hover:border-orange-500/50 rounded-2xl p-8 bg-[#121217]/50 text-center transition-all">
        <input
          type="file"
          id="file-upload"
          multiple
          onChange={handleFileUpload}
          disabled={isUploading}
          className="hidden"
          accept=".pdf,.docx,.doc,.txt,.csv,.jpg,.jpeg,.png"
        />
        <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400">
            {isUploading ? <Loader2 className="w-7 h-7 animate-spin" /> : <UploadCloud className="w-7 h-7" />}
          </div>
          <div>
            <p className="text-sm font-semibold text-white">
              {isUploading ? 'Ingesting and indexing documents...' : 'Click or drag files to upload'}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              Supports PDF, DOCX, TXT, CSV, JPG, PNG (PAN, Aadhaar, Resume, Notes)
            </p>
          </div>
        </label>
      </div>

      {/* Documents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="p-4 rounded-2xl border border-gray-800/80 bg-[#121217] hover:border-orange-500/30 transition-all flex flex-col justify-between space-y-3"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-gray-800 text-gray-300">
                  {doc.category.replace('_', ' ')}
                </span>
                {getStatusBadge(doc.extraction_status)}
              </div>
              <h4 className="text-sm font-bold text-gray-100 truncate" title={doc.original_filename}>
                {doc.original_filename}
              </h4>
              <p className="text-[11px] text-gray-500">
                {(doc.file_size / 1024).toFixed(1)} KB • {new Date(doc.created_at).toLocaleDateString()}
              </p>
            </div>

            <div className="pt-2 border-t border-gray-800/60 flex items-center justify-between text-xs">
              <button
                onClick={() => setSelectedDoc(doc)}
                className="text-orange-400 hover:text-orange-300 flex items-center gap-1 font-medium"
              >
                <Eye className="w-3.5 h-3.5" /> View Extracted
              </button>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleReprocess(doc.id)}
                  title="Reprocess"
                  className="p-1.5 text-gray-400 hover:text-orange-400 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(doc.id)}
                  title="Delete"
                  className="p-1.5 text-gray-400 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Extracted Detail Drawer / Modal */}
      {selectedDoc && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#14141a] border border-gray-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">{selectedDoc.original_filename}</h3>
                <span className="text-xs text-orange-400 uppercase font-semibold">
                  Category: {selectedDoc.category}
                </span>
              </div>
              <button
                onClick={() => setSelectedDoc(null)}
                className="text-gray-400 hover:text-white text-xs px-2.5 py-1 rounded-lg border border-gray-800"
              >
                Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
              {selectedDoc.structured_fields && Object.keys(selectedDoc.structured_fields).length > 0 && (
                <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 space-y-1">
                  <span className="font-semibold text-orange-300">Extracted Identity Fields:</span>
                  <pre className="text-gray-300 whitespace-pre-wrap font-mono text-[11px]">
                    {JSON.stringify(selectedDoc.structured_fields, null, 2)}
                  </pre>
                </div>
              )}

              <div>
                <span className="font-semibold text-gray-400">Extracted Content Preview:</span>
                <p className="mt-1 p-3 rounded-xl bg-[#0a0a0c] border border-gray-800/80 text-gray-300 whitespace-pre-wrap leading-relaxed">
                  {selectedDoc.extracted_text || 'No text extracted.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
