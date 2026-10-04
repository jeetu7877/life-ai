import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { Conversation, Message } from '../types';
import {
  Send,
  Mic,
  Volume2,
  Sparkles,
  Clock,
  Trash2,
  Plus,
  Bot,
  User as UserIcon,
  MessageSquare,
  X,
  FileText,
  Copy,
  Check,
  Paperclip,
  GraduationCap
} from 'lucide-react';
import { useVoice } from '../context/VoiceContext';

export const ChatPage: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [showMobileHistory, setShowMobileHistory] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { playAudioResponse, triggerManualListen } = useVoice();

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      const convList = await api.getConversations();
      if (Array.isArray(convList)) {
        setConversations(convList);
        if (convList.length > 0 && !activeConvId) {
          selectConversation(convList[0].id);
        }
      } else {
        setConversations([]);
      }
    } catch (err) {
      console.error('Error loading conversations:', err);
      setConversations([]);
    }
  };

  const selectConversation = async (convId: string) => {
    setActiveConvId(convId);
    try {
      const detail = await api.getConversation(convId);
      setMessages(Array.isArray(detail?.messages) ? detail.messages : []);
      scrollToBottom();
    } catch (err) {
      console.error('Error loading conversation messages:', err);
      setMessages([]);
    }
  };

  const handleStartNewChat = () => {
    setActiveConvId(null);
    setMessages([]);
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputMessage.trim() || isSending) return;

    const userText = inputMessage.trim();
    setInputMessage('');
    setIsSending(true);

    // Optimistic user message
    const tempUserMsg: Message = {
      id: `temp_${Date.now()}`,
      conversation_id: activeConvId || '',
      role: 'user',
      content: userText,
      timestamp: new Date().toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      local_time_str: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages(prev => [...prev, tempUserMsg]);
    scrollToBottom();

    try {
      const res = await api.sendMessage({
        content: userText,
        conversation_id: activeConvId || undefined,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      });

      if (!activeConvId) {
        setActiveConvId(res.conversation_id);
        loadConversations();
      }

      const assistantMsg: Message = {
        id: res.message_id,
        conversation_id: res.conversation_id,
        role: 'assistant',
        content: res.response,
        audio_url: res.audio_url,
        timestamp: new Date().toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        local_time_str: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        metadata_json: { sources: res.retrieved_sources }
      };

      setMessages(prev => [...prev, assistantMsg]);
      scrollToBottom();

      // Play voice if audio is available
      if (res.audio_url) {
        playAudioResponse(res.audio_url);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteConv = async (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    try {
      await api.deleteConversation(convId);
      setConversations(prev => prev.filter(c => c.id !== convId));
      if (activeConvId === convId) {
        handleStartNewChat();
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  };

  // Helper to extract roll number / identity fields for structured mini-cards
  const detectStructuredCard = (content: string) => {
    const rollMatch = content.match(/roll\s*(?:no\.?|number)?\s*(?:is|:)?\s*(\d{7,10})/i);
    if (rollMatch) {
      return {
        label: "Roll Number",
        value: rollMatch[1],
        source: "College ID (Uploaded Document)"
      };
    }
    const enrollMatch = content.match(/enrollment\s*(?:no\.?|number)?\s*(?:is|:)?\s*([A-Z0-9]{8,14})/i);
    if (enrollMatch) {
      return {
        label: "Enrollment Number",
        value: enrollMatch[1],
        source: "University Record"
      };
    }
    return null;
  };

  return (
    <div className="flex-1 flex h-full min-h-0 overflow-hidden relative">
      {/* Mobile Drawer Overlay */}
      {showMobileHistory && (
        <div 
          onClick={() => setShowMobileHistory(false)} 
          className="fixed inset-0 bg-black/80 z-40 lg:hidden backdrop-blur-sm"
        />
      )}

      {/* Conversations Drawer / Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#0A0F18] border-r border-[#202B3D] flex flex-col shrink-0 transition-transform duration-300 lg:static lg:translate-x-0 ${
        showMobileHistory ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        <div className="p-3.5 border-b border-[#202B3D] flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Conversations</span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                handleStartNewChat();
                setShowMobileHistory(false);
              }}
              className="text-xs px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-[#00A8FF]/15 to-[#8B5CF6]/15 text-[#00D9FF] hover:bg-[#00D9FF]/20 border border-[#00D9FF]/30 flex items-center gap-1.5 transition-all font-medium cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> New
            </button>
            <button
              onClick={() => setShowMobileHistory(false)}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.map(conv => (
            <div
              key={conv.id}
              onClick={() => {
                selectConversation(conv.id);
                setShowMobileHistory(false);
              }}
              className={`group flex items-center justify-between p-2.5 rounded-xl cursor-pointer text-xs transition-all ${
                activeConvId === conv.id
                  ? 'bg-gradient-to-r from-[#00A8FF]/20 to-[#8B5CF6]/20 border border-[#00D9FF]/40 text-[#00D9FF] font-semibold shadow-[0_0_12px_rgba(0,217,255,0.15)]'
                  : 'text-slate-400 hover:bg-[#101722] hover:text-slate-200'
              }`}
            >
              <div className="truncate flex-1 pr-2">
                <p className="truncate font-medium">{conv.title}</p>
                <span className="text-[10px] text-slate-500">
                  {new Date(conv.created_at).toLocaleDateString()}
                </span>
              </div>
              <button
                onClick={(e) => handleDeleteConv(e, conv.id)}
                className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 p-1 transition-opacity cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {conversations.length === 0 && (
            <div className="p-4 text-center text-xs text-slate-500">No chats yet. Start talking to Life!</div>
          )}
        </div>
      </div>

      {/* Main Chat Stream */}
      <div className="flex-1 flex flex-col min-h-0 h-full overflow-hidden bg-[#05070B] min-w-0">
        {/* Mobile / Header Chat Bar */}
        <div className="h-12 border-b border-[#202B3D] px-4 flex items-center justify-between bg-[#0A0F18]/90 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowMobileHistory(true)}
              className="lg:hidden px-2.5 py-1 rounded-xl border border-[#202B3D] bg-[#101722] text-slate-300 hover:text-white flex items-center gap-1.5 text-xs cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5 text-[#00D9FF]" />
              <span>History ({conversations.length})</span>
            </button>
            <div className="hidden lg:flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#22C55E]"></span>
              <span className="text-xs font-semibold text-slate-200 truncate max-w-sm">
                {activeConvId ? (conversations.find(c => c.id === activeConvId)?.title || 'Active Conversation') : 'New Conversation'}
              </span>
            </div>
          </div>

          <button
            onClick={handleStartNewChat}
            className="text-xs px-3 py-1 rounded-xl bg-gradient-to-r from-[#00A8FF]/15 to-[#8B5CF6]/15 text-[#00D9FF] hover:bg-[#00D9FF]/20 border border-[#00D9FF]/30 flex items-center gap-1.5 font-medium cursor-pointer transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ New Chat</span>
          </button>
        </div>

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="py-8 flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#00A8FF]/20 via-[#00D9FF]/20 to-[#8B5CF6]/20 border border-[#00D9FF]/40 flex items-center justify-center text-[#00D9FF] shadow-[0_0_24px_rgba(0,217,255,0.25)]">
                <Sparkles className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Chat with Life AI</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                  Instant answers from your uploaded college IDs, marksheet, resume, and personal memories.
                </p>
              </div>

              {/* Quick Suggestion Pills */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full pt-2">
                {[
                  "Mera roll number kya hai?",
                  "What is my college?",
                  "Meri bestie ka naam kya hai?",
                  "What are my DBMS marks in semester 5?"
                ].map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setInputMessage(prompt);
                    }}
                    className="text-xs p-3 rounded-xl border border-[#202B3D] bg-[#101722] hover:border-[#00D9FF]/40 hover:bg-[#141C28] text-slate-300 text-left transition-all cursor-pointer flex items-center gap-2 group"
                  >
                    <span className="text-[#00D9FF] opacity-70 group-hover:opacity-100">"</span>
                    <span className="truncate">{prompt}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, index) => {
              const isUser = msg.role === 'user';
              const structured = !isUser ? detectStructuredCard(msg.content) : null;

              return (
                <div
                  key={msg.id || index}
                  className={`flex gap-3 max-w-2xl ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
                >
                  <div
                    className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center text-xs font-bold ${
                      isUser
                        ? 'bg-gradient-to-tr from-[#00A8FF] to-[#0066FF] text-white shadow-[0_0_12px_rgba(0,168,255,0.4)]'
                        : 'bg-[#101722] text-[#00D9FF] border border-[#202B3D] shadow-[0_0_12px_rgba(0,217,255,0.2)]'
                    }`}
                  >
                    {isUser ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>

                  <div className="space-y-1.5 max-w-[85%]">
                    <div
                      className={`p-3.5 rounded-2xl text-sm leading-relaxed ${
                        isUser
                          ? 'bg-gradient-to-r from-[#0088EE] to-[#0066DD] text-white rounded-tr-none shadow-[0_0_20px_rgba(0,136,238,0.25)]'
                          : 'bg-[#101722] border border-[#202B3D] text-slate-200 rounded-tl-none shadow-md'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>

                      {/* Structured Identity Card if document field mentioned */}
                      {structured && (
                        <div className="mt-3 p-3 rounded-xl bg-[#141C28] border border-[#00D9FF]/30 space-y-1 shadow-inner">
                          <div className="flex items-center justify-between text-xs text-[#00D9FF] font-semibold">
                            <span className="flex items-center gap-1.5">
                              <GraduationCap className="w-4 h-4 text-[#00D9FF]" />
                              {structured.label}
                            </span>
                            <button
                              onClick={() => handleCopy(structured.value, msg.id)}
                              className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              {copiedId === msg.id ? (
                                <>
                                  <Check className="w-3 h-3 text-[#22C55E]" /> Copied
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" /> Copy
                                </>
                              )}
                            </button>
                          </div>
                          <p className="text-base font-bold font-mono text-white tracking-wider">
                            {structured.value}
                          </p>
                          <span className="text-[10px] text-slate-400 block pt-0.5">
                            Source: {structured.source}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Meta info & source badges */}
                    <div className={`flex items-center gap-2 text-[11px] text-slate-500 ${isUser ? 'justify-end' : 'justify-start'}`}>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {msg.local_time_str || new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>

                      {!isUser && msg.audio_url && (
                        <button
                          onClick={() => playAudioResponse(msg.audio_url!)}
                          className="hover:text-[#00D9FF] flex items-center gap-1 text-[10px] bg-[#101722] px-2 py-0.5 rounded-lg border border-[#202B3D] transition-colors cursor-pointer"
                        >
                          <Volume2 className="w-3 h-3 text-[#00D9FF]" /> Replay
                        </button>
                      )}

                      {!isUser && msg.metadata_json?.sources && msg.metadata_json.sources.length > 0 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-lg bg-[#00D9FF]/10 text-[#00D9FF] border border-[#00D9FF]/20 flex items-center gap-1">
                          <FileText className="w-2.5 h-2.5" />
                          {msg.metadata_json.sources.map(s => s.source).join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          {isSending && (
            <div className="flex gap-3 max-w-2xl mr-auto items-center text-xs text-[#00D9FF]">
              <div className="w-8 h-8 rounded-xl bg-[#101722] border border-[#202B3D] flex items-center justify-center">
                <Bot className="w-4 h-4 text-[#00D9FF]" />
              </div>
              <div className="p-3 rounded-2xl bg-[#101722] border border-[#202B3D] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#00D9FF] animate-ping" />
                Life AI is thinking & retrieving knowledge...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Pinned Bottom Glassmorphic Input Bar */}
        <div className="shrink-0 p-3 sm:p-4 pb-24 md:pb-4 border-t border-[#202B3D] bg-[#0A0F18]/95 backdrop-blur-xl z-20">
          <form onSubmit={handleSend} className="max-w-4xl mx-auto flex items-center gap-2">
            <div className="flex-1 relative flex items-center">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Ask Life anything about documents, memories, or talk in Hindi & English..."
                className="w-full bg-[#101722] border border-[#202B3D] rounded-2xl pl-4 pr-11 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-[#00D9FF] focus:ring-1 focus:ring-[#00D9FF]/30 transition-all shadow-inner"
              />
              <button
                type="button"
                onClick={triggerManualListen}
                title="Tap to speak"
                className="absolute right-3 text-slate-400 hover:text-[#00D9FF] transition-colors p-1 cursor-pointer"
              >
                <Mic className="w-4 h-4" />
              </button>
            </div>
            <button
              type="submit"
              disabled={!inputMessage.trim() || isSending}
              className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#00A8FF] to-[#8B5CF6] hover:from-[#00D9FF] hover:to-[#A855F7] disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center shadow-[0_0_16px_rgba(0,168,255,0.4)] transition-all shrink-0 cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
