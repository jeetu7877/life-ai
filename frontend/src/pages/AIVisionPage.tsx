import React, { useState, useRef, useEffect } from 'react';
import { api } from '../services/api';
import { useToast } from '../components/ui/Toast';
import {
  Eye,
  Upload,
  Image as ImageIcon,
  Sparkles,
  Copy,
  Check,
  RefreshCw,
  Send,
  FileText,
  BookmarkPlus,
  HelpCircle,
  X,
  Calculator,
  Layers,
  ArrowRight
} from 'lucide-react';

interface AnalysisHistoryItem {
  id: string;
  question: string;
  answer: string;
  type: string;
  timestamp: string;
}

export const AIVisionPage: React.FC = () => {
  const { success, error, info } = useToast();
  const showToast = (msg: string, type: string = 'info') => {
    if (type === 'success') success(msg);
    else if (type === 'error') error(msg);
    else info(msg);
  };
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [question, setQuestion] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisHistory, setAnalysisHistory] = useState<AnalysisHistoryItem[]>([]);
  const [currentResult, setCurrentResult] = useState<{
    answer: string;
    detected_text?: string;
    type: string;
  } | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  const suggestedPrompts = [
    { label: 'What is this?', icon: HelpCircle },
    { label: 'Explain this image', icon: Sparkles },
    { label: 'Solve this step by step', icon: Calculator },
    { label: 'Extract all text', icon: FileText },
    { label: 'Explain this diagram', icon: Layers },
    { label: 'Convert into notes', icon: BookmarkPlus }
  ];

  // Clipboard paste support
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            handleImageSelected(file);
            showToast('Image pasted from clipboard', 'info');
          }
          break;
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const handleImageSelected = (file: File) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type.toLowerCase())) {
      showToast('Please select a JPG, PNG, or WEBP image.', 'error');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      showToast('Image file size must be less than 15MB.', 'error');
      return;
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setImagePreviewUrl(url);
    setCurrentResult(null);
    setAnalysisHistory([]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleImageSelected(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageSelected(e.dataTransfer.files[0]);
    }
  };

  const handleAnalyze = async (customPrompt?: string) => {
    const promptToSend = (customPrompt || question).trim() || 'Analyze this image and explain what is visible in detail.';
    if (!selectedFile) {
      showToast('Please upload or select an image first.', 'warning');
      return;
    }

    try {
      setIsAnalyzing(true);
      const res = await api.analyzeVision(selectedFile, promptToSend);

      if (res && res.success) {
        const item: AnalysisHistoryItem = {
          id: `vis_${Date.now()}`,
          question: promptToSend,
          answer: res.answer,
          type: res.type || 'general',
          timestamp: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })
        };
        setCurrentResult({
          answer: res.answer,
          detected_text: res.detected_text,
          type: res.type || 'general'
        });
        setAnalysisHistory(prev => [item, ...prev]);
        setQuestion('');
        showToast('Image analysis complete!', 'success');
      } else {
        showToast(res?.answer || 'Failed to analyze image.', 'error');
      }
    } catch (err: any) {
      console.error('Vision analysis error:', err);
      const msg = err?.response?.data?.detail || err.message || 'Vision analysis failed';
      showToast(msg, 'error');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    showToast('Copied to clipboard', 'info');
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleSaveToDocuments = async () => {
    if (!selectedFile) return;
    try {
      const formData = new FormData();
      formData.append('files', selectedFile);
      await api.uploadDocuments(formData);
      showToast('Saved to Documents library!', 'success');
    } catch (err: any) {
      showToast('Failed to save to Documents: ' + (err.message || 'error'), 'error');
    }
  };

  const handleSaveToNotes = () => {
    if (!currentResult) return;
    try {
      const existing = JSON.parse(localStorage.getItem('life_user_notes') || '[]');
      const newNote = {
        id: `note_${Date.now()}`,
        title: `Vision Analysis: ${selectedFile?.name || 'Image'}`,
        content: currentResult.answer,
        category: 'Study',
        isPinned: false,
        updatedAt: new Date().toISOString()
      };
      localStorage.setItem('life_user_notes', JSON.stringify([newNote, ...existing]));
      showToast('Saved to Notes!', 'success');
    } catch {
      showToast('Saved note locally', 'info');
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImagePreviewUrl(null);
    setCurrentResult(null);
    setAnalysisHistory([]);
    setQuestion('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#05070B] text-slate-100 p-4 md:p-8 custom-scrollbar">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#00D9FF]/20 to-[#8B5CF6]/20 border border-[#00D9FF]/40 flex items-center justify-center text-[#00D9FF] shadow-[0_0_15px_rgba(0,217,255,0.2)]">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                AI Vision
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#00D9FF]/15 text-[#00D9FF] border border-[#00D9FF]/30 uppercase">
                  Multimodal
                </span>
              </h1>
              <p className="text-xs text-slate-400">Understand photos, equations, diagrams & documents with Gemini Vision</p>
            </div>
          </div>

          {selectedFile && (
            <button
              onClick={handleReset}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" /> New Image
            </button>
          )}
        </div>

        {/* Upload Dropzone / Image Preview Area */}
        {!imagePreviewUrl ? (
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-3xl p-8 md:p-12 text-center transition-all cursor-pointer ${
              isDragOver
                ? 'border-[#00D9FF] bg-[#00D9FF]/10 scale-[1.01]'
                : 'border-[#202B3D] bg-[#0E1622]/60 hover:border-[#00D9FF]/50 hover:bg-[#0E1622]'
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/jpg"
              className="hidden"
              onChange={handleFileChange}
            />

            <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-tr from-[#00D9FF]/20 to-[#8B5CF6]/20 border border-[#00D9FF]/30 flex items-center justify-center text-[#00D9FF] mb-4 shadow-[0_0_20px_rgba(0,217,255,0.15)]">
              <Upload className="w-8 h-8" />
            </div>

            <h3 className="text-base font-bold text-white mb-1">
              Select or Drop an Image
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto mb-5">
              Choose an image from phone gallery, pick a file, drag & drop, or paste from clipboard (Ctrl+V)
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-[#00A8FF] to-[#00D9FF] text-[#05070B] font-bold text-xs flex items-center gap-2 shadow-[0_0_15px_rgba(0,217,255,0.3)] hover:brightness-110 transition-all cursor-pointer"
              >
                <ImageIcon className="w-4 h-4" /> Open Gallery / Files
              </button>
            </div>

            <p className="text-[10px] text-slate-500 mt-4">
              Supports JPG, PNG, WEBP • Max 15MB • Zero permanent retention without consent
            </p>
          </div>
        ) : (
          /* Active Image Preview & Prompt Panel */
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#0E1622] border border-[#202B3D] rounded-3xl p-4 md:p-6 shadow-xl">
              {/* Image Preview */}
              <div className="relative rounded-2xl overflow-hidden bg-black/50 border border-slate-800 flex items-center justify-center min-h-[240px] max-h-[360px]">
                <img
                  src={imagePreviewUrl}
                  alt="Uploaded for analysis"
                  className="max-h-[350px] w-auto max-w-full object-contain rounded-xl"
                />
                <div className="absolute top-2 left-2 px-2.5 py-1 rounded-xl bg-black/70 backdrop-blur-md text-[10px] font-semibold text-slate-300 border border-slate-700">
                  {selectedFile?.name || 'Selected Image'}
                </div>
              </div>

              {/* Controls & Suggested Prompts */}
              <div className="flex flex-col justify-between space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#00D9FF]" /> Suggested Questions
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {suggestedPrompts.map((p, idx) => {
                      const Icon = p.icon;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleAnalyze(p.label)}
                          disabled={isAnalyzing}
                          className="p-2.5 rounded-xl bg-[#141F30] hover:bg-[#1A283E] text-slate-200 border border-slate-800 hover:border-[#00D9FF]/40 text-left text-xs font-medium flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                        >
                          <Icon className="w-3.5 h-3.5 text-[#00D9FF] shrink-0" />
                          <span className="truncate">{p.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Question Input Composer */}
                <div className="space-y-2">
                  <div className="relative">
                    <input
                      type="text"
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleAnalyze();
                        }
                      }}
                      placeholder="Ask Life AI about this image..."
                      disabled={isAnalyzing}
                      className="w-full bg-[#141F30] border border-[#202B3D] focus:border-[#00D9FF] rounded-2xl py-3 pl-4 pr-12 text-xs text-white placeholder-slate-500 focus:outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => handleAnalyze()}
                      disabled={isAnalyzing}
                      className="absolute right-1.5 top-1.5 bottom-1.5 px-3 rounded-xl bg-gradient-to-r from-[#00A8FF] to-[#00D9FF] text-[#05070B] font-bold text-xs flex items-center justify-center hover:brightness-110 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isAnalyzing ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Loading Indicator */}
            {isAnalyzing && (
              <div className="p-6 rounded-3xl bg-[#0E1622] border border-[#00D9FF]/40 flex items-center justify-center gap-3 text-[#00D9FF] text-xs font-semibold animate-pulse shadow-[0_0_25px_rgba(0,217,255,0.15)]">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Life AI is scanning visual features with Gemini Vision...</span>
              </div>
            )}

            {/* Analysis Results */}
            {currentResult && (
              <div className="bg-[#0E1622] border border-[#202B3D] rounded-3xl p-5 md:p-6 space-y-4 shadow-xl">
                <div className="flex items-center justify-between pb-3 border-b border-[#202B3D]">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#00D9FF] animate-pulse" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Life AI Visual Analysis
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#8B5CF6]/20 text-[#8B5CF6] border border-[#8B5CF6]/30 uppercase">
                      {currentResult.type.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopy(currentResult.answer, 0)}
                      className="p-1.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
                      title="Copy Answer"
                    >
                      {copiedIndex === 0 ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={handleSaveToNotes}
                      className="px-2.5 py-1 rounded-xl bg-purple-500/15 text-purple-300 hover:bg-purple-500/25 border border-purple-500/30 text-[10px] font-bold transition-colors cursor-pointer"
                    >
                      + Save to Notes
                    </button>
                    <button
                      onClick={handleSaveToDocuments}
                      className="px-2.5 py-1 rounded-xl bg-[#00D9FF]/15 text-[#00D9FF] hover:bg-[#00D9FF]/25 border border-[#00D9FF]/30 text-[10px] font-bold transition-colors cursor-pointer"
                    >
                      + Save to Documents
                    </button>
                  </div>
                </div>

                <div className="text-xs md:text-sm text-slate-200 leading-relaxed whitespace-pre-line font-['Plus_Jakarta_Sans',sans-serif]">
                  {currentResult.answer}
                </div>
              </div>
            )}

            {/* Conversation History / Multi-turn Questions for this Photo */}
            {analysisHistory.length > 1 && (
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Previous Questions on this Photo
                </h4>
                {analysisHistory.slice(1).map((item, idx) => (
                  <div key={item.id} className="p-4 rounded-2xl bg-[#0E1622]/60 border border-[#202B3D] space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold text-[#00D9FF]">
                      <span>Q: "{item.question}"</span>
                      <span className="text-slate-500 text-[10px]">{item.timestamp}</span>
                    </div>
                    <p className="text-xs text-slate-300 whitespace-pre-line line-clamp-3">
                      {item.answer}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
