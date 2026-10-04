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
  GraduationCap,
  Globe,
  Code,
  CheckSquare,
  Brain,
  Edit2,
  AlertCircle,
  RefreshCw,
  ChevronDown
} from 'lucide-react';
import companionImg from '../assets/companion/companion-idle.jpg';
import { useVoice } from '../context/VoiceContext';
import { useToast } from '../components/ui/Toast';
import { ConfirmationDialog } from '../components/ui/ConfirmationDialog';

export const ChatPage: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [showMobileHistory, setShowMobileHistory] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState<boolean>(false);
  const [showQuickActions, setShowQuickActions] = useState<boolean>(false);

  // Dialogs
  const [convToDelete, setConvToDelete] = useState<string | null>(null);
  const [convToRename, setConvToRename] = useState<Conversation | null>(null);
  const [renameTitleInput, setRenameTitleInput] = useState<string>('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef<boolean>(true);

  const { playAudioResponse, triggerManualListen, voiceState } = useVoice();
  const { success, error } = useToast();

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
      scrollToBottom(true);
    } catch (err) {
      console.error('Error loading conversation messages:', err);
      setMessages([]);
    }
  };

  const handleStartNewChat = () => {
    setActiveConvId(null);
    setMessages([]);
  };

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
    const isNear = distanceFromBottom < 120;
    isNearBottomRef.current = isNear;
    setShowScrollBottomBtn(!isNear);
  };

  const scrollToBottom = (force: boolean = false) => {
    setTimeout(() => {
      if (force || isNearBottomRef.current) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
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
    scrollToBottom(true);

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
        metadata_json: {
          sources: res.retrieved_sources,
          timing: res.timing
        }
      };

      setMessages(prev => [...prev, assistantMsg]);
      scrollToBottom();

      // Play voice if audio is available
      if (res.audio_url) {
        playAudioResponse(res.audio_url);
      }
      setLastFailedPrompt(null);
    } catch (err: any) {
      console.error('Failed to send message:', err);
      setLastFailedPrompt(userText);
      error(err.response?.data?.detail || 'Failed to send message. Please retry.');
    } finally {
      setIsSending(false);
    }
  };

  const handleConfirmDeleteConv = async () => {
    if (!convToDelete) return;
    try {
      await api.deleteConversation(convToDelete);
      setConversations(prev => prev.filter(c => c.id !== convToDelete));
      if (activeConvId === convToDelete) {
        handleStartNewChat();
      }
      success('Conversation deleted.');
    } catch (err) {
      console.error('Failed to delete conversation:', err);
      error('Failed to delete conversation.');
    } finally {
      setConvToDelete(null);
    }
  };

  const handleSaveRenameConv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!convToRename || !renameTitleInput.trim()) return;
    try {
      const updated = await api.renameConversation(convToRename.id, renameTitleInput.trim());
      setConversations(prev => prev.map(c => c.id === convToRename.id ? { ...c, title: updated.title } : c));
      success('Conversation renamed.');
      setConvToRename(null);
      setRenameTitleInput('');
    } catch (err) {
      console.error('Failed to rename conversation:', err);
      error('Failed to rename conversation.');
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

  // Helper to safely render markdown content with contained code blocks
  const renderMessageContent = (content: string, msgId: string) => {
    const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        const textBefore = content.substring(lastIndex, match.index);
        parts.push(
          <span key={`text-${lastIndex}`} className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
            {textBefore}
          </span>
        );
      }

      const lang = match[1] || 'code';
      const code = match[2];
      const blockKey = `code-${match.index}`;

      parts.push(
        <div key={blockKey} className="w-full max-w-full min-w-0 my-2.5 overflow-hidden rounded-xl border border-[#202B3D] bg-[#080D15]">
          <div className="flex items-center justify-between px-3 py-1.5 bg-[#101722] border-b border-[#202B3D] text-[11px] text-slate-400 font-mono">
            <span className="text-[#00D9FF] font-semibold">{lang}</span>
            <button
              type="button"
              onClick={() => handleCopy(code, `${msgId}-${blockKey}`)}
              className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer text-[10px]"
            >
              {copiedId === `${msgId}-${blockKey}` ? (
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
          <pre className="code-scroll p-3 text-xs font-mono text-emerald-300 leading-relaxed overflow-x-auto m-0">
            <code>{code}</code>
          </pre>
        </div>
      );

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < content.length) {
      const textRemaining = content.substring(lastIndex);
      parts.push(
        <span key={`text-${lastIndex}`} className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
          {textRemaining}
        </span>
      );
    }

    return parts.length > 0 ? parts : <span className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{content}</span>;
  };

  return (
    <div className="flex-1 flex h-full min-h-0 overflow-hidden relative w-full max-w-full box-border">
      {/* Mobile Drawer Overlay */}
      {showMobileHistory && (
        <div 
          onClick={() => setShowMobileHistory(false)} 
          className="fixed inset-0 bg-black/80 z-40 lg:hidden backdrop-blur-sm"
        />
      )}

      {/* Conversations Drawer / Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-[#0A0F18] border-r border-[#202B3D] flex flex-col shrink-0 transition-transform duration-300 lg:static lg:translate-x-0 ${
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
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setConvToRename(conv);
                    setRenameTitleInput(conv.title);
                  }}
                  className="text-slate-500 hover:text-[#00D9FF] p-1 transition-colors cursor-pointer"
                  title="Rename chat"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setConvToDelete(conv.id);
                  }}
                  className="text-slate-500 hover:text-red-400 p-1 transition-colors cursor-pointer"
                  title="Delete chat"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
          {conversations.length === 0 && (
            <div className="p-4 text-center text-xs text-slate-500">No chats yet. Start talking to Life!</div>
          )}
        </div>
      </div>

      {/* Main Chat Stream */}
      <div className="flex-1 flex flex-col min-h-0 h-full overflow-hidden bg-[#05070B] min-w-0 w-full max-w-full relative">
        {/* Mobile / Desktop Header Chat Bar */}
        <div className="h-12 border-b border-[#202B3D] px-2.5 sm:px-4 flex items-center justify-between bg-[#0A0F18]/90 backdrop-blur-md shrink-0 w-full max-w-full min-w-0 box-border">
          {/* Left: Mobile History Button */}
          <button
            onClick={() => setShowMobileHistory(true)}
            className="lg:hidden px-2 sm:px-2.5 py-1 rounded-xl border border-[#202B3D] bg-[#101722] text-slate-300 hover:text-white flex items-center gap-1.5 text-xs shrink-0 cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5 text-[#00D9FF]" />
            <span className="hidden xs:inline">History</span>
            <span className="text-[10px] text-slate-400">({conversations.length})</span>
          </button>

          {/* Center: Conversation Title */}
          <div className="flex-1 min-w-0 px-2 text-center flex items-center justify-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#22C55E] shrink-0" />
            <span className="text-xs font-semibold text-slate-200 truncate max-w-[160px] xs:max-w-xs sm:max-w-md">
              {activeConvId ? (conversations.find(c => c.id === activeConvId)?.title || 'Conversation') : 'New Conversation'}
            </span>
          </div>

          {/* Right: New Chat */}
          <button
            onClick={handleStartNewChat}
            className="text-xs px-2.5 sm:px-3 py-1 rounded-xl bg-gradient-to-r from-[#00A8FF]/15 to-[#8B5CF6]/15 text-[#00D9FF] hover:bg-[#00D9FF]/20 border border-[#00D9FF]/30 flex items-center gap-1 font-medium cursor-pointer transition-all shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">New Chat</span>
            <span className="xs:hidden">New</span>
          </button>
        </div>

        {/* Messages Stream */}
        <div 
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-3.5 sm:space-y-4 w-full max-w-full min-w-0 box-border relative"
        >
          {messages.length === 0 ? (
            <div className="py-6 sm:py-8 flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-4 px-2 w-full min-w-0">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden border-2 border-[#00D9FF]/40 shadow-[0_0_24px_rgba(0,217,255,0.3)] bg-black shrink-0">
                <img src={companionImg} alt="Life AI Companion" className="w-full h-full object-cover object-top" />
              </div>
              <div className="w-full min-w-0">
                <h3 className="text-base sm:text-lg font-bold text-white">Chat with Life AI Companion</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
                  Instant answers from your uploaded college IDs, marksheet, resume, and personal memories.
                </p>
              </div>

              {/* Quick Suggestion Pills */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full pt-2 min-w-0">
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
                    className="text-xs p-2.5 sm:p-3 rounded-xl border border-[#202B3D] bg-[#101722] hover:border-[#00D9FF]/40 hover:bg-[#141C28] text-slate-300 text-left transition-all cursor-pointer flex items-center gap-2 group min-w-0 w-full"
                  >
                    <span className="text-[#00D9FF] opacity-70 group-hover:opacity-100 shrink-0">"</span>
                    <span className="truncate flex-1 min-w-0">{prompt}</span>
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
                  className={`flex gap-2 sm:gap-3 w-full max-w-3xl min-w-0 ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
                >
                  <div
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl shrink-0 overflow-hidden flex items-center justify-center text-xs font-bold ${
                      isUser
                        ? 'bg-gradient-to-tr from-[#00A8FF] to-[#0066FF] text-white shadow-[0_0_12px_rgba(0,168,255,0.4)]'
                        : 'bg-black border border-[#00D9FF]/30 shadow-[0_0_12px_rgba(0,217,255,0.2)]'
                    }`}
                  >
                    {isUser ? (
                      <UserIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    ) : (
                      <img src={companionImg} alt="Life Companion" className="w-full h-full object-cover object-top" />
                    )}
                  </div>

                  <div className="space-y-1.5 max-w-[calc(100%-36px)] sm:max-w-[82%] min-w-0 flex-1">
                    <div
                      className={`p-3 sm:p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed break-words [overflow-wrap:anywhere] min-w-0 ${
                        isUser
                          ? 'bg-gradient-to-r from-[#0088EE] to-[#0066DD] text-white rounded-tr-none shadow-[0_0_20px_rgba(0,136,238,0.25)]'
                          : 'bg-[#101722] border border-[#202B3D] text-slate-200 rounded-tl-none shadow-md'
                      }`}
                    >
                      {renderMessageContent(msg.content, msg.id || `msg-${index}`)}

                      {/* Structured Identity Card if document field mentioned */}
                      {structured && (
                        <div className="mt-3 p-2.5 sm:p-3 rounded-xl bg-[#141C28] border border-[#00D9FF]/30 space-y-1 shadow-inner w-full min-w-0 max-w-full">
                          <div className="flex items-center justify-between text-xs text-[#00D9FF] font-semibold gap-2">
                            <span className="flex items-center gap-1.5 truncate">
                              <GraduationCap className="w-4 h-4 text-[#00D9FF] shrink-0" />
                              <span className="truncate">{structured.label}</span>
                            </span>
                            <button
                              onClick={() => handleCopy(structured.value, msg.id)}
                              className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer shrink-0"
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
                          <p className="text-sm sm:text-base font-bold font-mono text-white tracking-wider break-all">
                            {structured.value}
                          </p>
                          <span className="text-[10px] text-slate-400 block pt-0.5 truncate">
                            Source: {structured.source}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Meta info & source badges */}
                    <div className={`flex flex-wrap items-center gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] text-slate-500 min-w-0 max-w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
                      <span className="flex items-center gap-1 shrink-0">
                        <Clock className="w-3 h-3" />
                        {msg.local_time_str || new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>

                      {!isUser && msg.audio_url && (
                        <button
                          onClick={() => playAudioResponse(msg.audio_url!)}
                          className="hover:text-[#00D9FF] flex items-center gap-1 text-[10px] bg-[#101722] px-2 py-0.5 rounded-lg border border-[#202B3D] transition-colors cursor-pointer shrink-0"
                        >
                          <Volume2 className="w-3 h-3 text-[#00D9FF]" /> Replay
                        </button>
                      )}

                      {!isUser && msg.metadata_json?.sources && msg.metadata_json.sources.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 min-w-0">
                          {msg.metadata_json.sources.map((s, sIdx) => {
                            const src = s.source;
                            if (src === 'github_code') {
                              return (
                                <span key={sIdx} className="text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 font-mono shrink-0">
                                  <Code className="w-2.5 h-2.5" /> GitHub Code
                                </span>
                              );
                            }
                            if (src === 'web_search') {
                              return (
                                <span key={sIdx} className="text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/30 flex items-center gap-1 shrink-0">
                                  <Globe className="w-2.5 h-2.5" /> Web Cited
                                </span>
                              );
                            }
                            if (src === 'long_term_memory' || src === 'profile_memory') {
                              return (
                                <span key={sIdx} className="text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/30 flex items-center gap-1 shrink-0">
                                  <Brain className="w-2.5 h-2.5" /> Memory
                                </span>
                              );
                            }
                            if (src === 'document_field' || src === 'documents') {
                              return (
                                <span key={sIdx} className="text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-lg bg-[#00D9FF]/10 text-[#00D9FF] border border-[#00D9FF]/30 flex items-center gap-1 shrink-0">
                                  <FileText className="w-2.5 h-2.5" /> Doc Verified
                                </span>
                              );
                            }
                            if (src === 'task_planner' || src === 'reminder_service') {
                              return (
                                <span key={sIdx} className="text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1 shrink-0">
                                  <CheckSquare className="w-2.5 h-2.5" /> Action
                                </span>
                              );
                            }
                            return (
                              <span key={sIdx} className="text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-lg bg-slate-800/80 text-slate-300 border border-slate-700 flex items-center gap-1 shrink-0">
                                <FileText className="w-2.5 h-2.5" /> {src.replace('_', ' ')}
                              </span>
                            );
                          })}
                        </div>
                      )}

                      {!isUser && msg.metadata_json?.timing && (
                        <div
                          title={`Execution: ${msg.metadata_json.timing.total_ms}ms (Router: ${msg.metadata_json.timing.router_ms || 0}ms, Cache: ${msg.metadata_json.timing.cache_ms || 0}ms, LLM: ${msg.metadata_json.timing.llm_ms || 0}ms) | Intent: ${msg.metadata_json.timing.route || 'GENERAL'}`}
                          className={`text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-lg flex items-center gap-1 font-mono transition-all shrink-0 ${
                            !msg.metadata_json.timing.llm_used
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                              : 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/25'
                          }`}
                        >
                          <Sparkles className="w-2.5 h-2.5 text-yellow-400 shrink-0" />
                          <span>{msg.metadata_json.timing.total_ms}ms</span>
                          {!msg.metadata_json.timing.llm_used ? (
                            <span className="text-[8px] sm:text-[9px] font-semibold text-emerald-400 uppercase tracking-wider">Zero-LLM</span>
                          ) : msg.metadata_json.timing.cache_hit ? (
                            <span className="text-[8px] sm:text-[9px] font-semibold text-sky-400 uppercase tracking-wider">Cache</span>
                          ) : (
                            <span className="text-[8px] sm:text-[9px] text-slate-400 uppercase">{msg.metadata_json.timing.provider || 'AI'}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          {isSending && (
            <div className="flex gap-2 sm:gap-3 max-w-2xl mr-auto items-center text-xs text-[#00D9FF]">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-[#101722] border border-[#202B3D] flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-[#00D9FF]" />
              </div>
              <div className="p-2.5 sm:p-3 rounded-2xl bg-[#101722] border border-[#202B3D] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#00D9FF] animate-ping shrink-0" />
                <span className="truncate">Life AI is thinking & retrieving knowledge...</span>
              </div>
            </div>
          )}
          {lastFailedPrompt && (
            <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 flex items-center justify-between gap-2 animate-fadeIn w-full">
              <div className="flex items-center gap-2 min-w-0">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span className="truncate">Failed to send: "{lastFailedPrompt.slice(0, 35)}..."</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const prompt = lastFailedPrompt;
                  setLastFailedPrompt(null);
                  setInputMessage(prompt);
                }}
                className="px-2.5 py-1 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-200 font-semibold flex items-center gap-1 cursor-pointer shrink-0 text-xs"
              >
                <RefreshCw className="w-3 h-3" /> Retry
              </button>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Floating Jump to Latest Button */}
        {showScrollBottomBtn && (
          <button
            type="button"
            onClick={() => {
              messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
              setShowScrollBottomBtn(false);
            }}
            className="absolute bottom-20 sm:bottom-24 right-4 sm:right-6 z-30 px-3 py-1.5 rounded-full bg-[#101722]/90 border border-[#00D9FF]/40 text-[#00D9FF] text-xs font-semibold shadow-lg backdrop-blur-md flex items-center gap-1.5 hover:bg-[#141C28] transition-all cursor-pointer animate-bounce"
          >
            <ChevronDown className="w-3.5 h-3.5" />
            <span>Latest</span>
          </button>
        )}

        {/* Pinned Bottom Glassmorphic Input Bar */}
        <div className="shrink-0 p-2 sm:p-3.5 pb-20 md:pb-4 border-t border-[#202B3D] bg-[#0A0F18]/95 backdrop-blur-xl z-20 w-full max-w-full min-w-0 box-border safe-bottom">
          {/* Quick Suggestions Bar horizontally scrollable directly above composer */}
          <div className="max-w-4xl mx-auto mb-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 px-0.5 min-w-0 w-full">
            {[
              "Mera roll number kya hai?",
              "What is my college?",
              "Meri bestie ka naam kya hai?",
              "What are my DBMS marks in semester 5?"
            ].map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setInputMessage(prompt);
                }}
                className="text-[11px] whitespace-nowrap px-3 py-1 rounded-full border border-[#202B3D] bg-[#101722]/90 hover:border-[#00D9FF]/40 hover:bg-[#141C28] text-slate-300 transition-all cursor-pointer flex items-center gap-1.5 shrink-0 shadow-sm"
              >
                <span className="text-[#00D9FF] text-xs font-bold leading-none">"</span>
                <span className="truncate">{prompt}</span>
              </button>
            ))}
          </div>

          <form onSubmit={handleSend} className="max-w-4xl mx-auto flex items-center gap-1.5 sm:gap-2 w-full min-w-0 relative">
            {/* [+] Quick Action Button */}
            <button
              type="button"
              onClick={() => setShowQuickActions(prev => !prev)}
              title="Quick Shortcuts"
              className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-[#101722] border border-[#202B3D] hover:border-[#00D9FF]/40 text-slate-400 hover:text-[#00D9FF] flex items-center justify-center shrink-0 transition-all cursor-pointer shadow-sm"
            >
              <Plus className={`w-4 h-4 transition-transform ${showQuickActions ? 'rotate-45 text-[#00D9FF]' : ''}`} />
            </button>

            {/* Quick Actions Popup Menu */}
            {showQuickActions && (
              <div className="absolute bottom-12 left-0 z-30 p-2 bg-[#0F1722] border border-[#223147] rounded-2xl shadow-2xl flex flex-col gap-1 w-52 animate-fadeIn backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => {
                    setInputMessage("Check my documents and summarize key details.");
                    setShowQuickActions(false);
                  }}
                  className="px-3 py-2 rounded-xl text-left text-xs text-slate-200 hover:bg-[#162232] hover:text-[#00D9FF] flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-[#00D9FF]" /> Document Summary
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInputMessage("What are my current goals and milestones?");
                    setShowQuickActions(false);
                  }}
                  className="px-3 py-2 rounded-xl text-left text-xs text-slate-200 hover:bg-[#162232] hover:text-[#00D9FF] flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <CheckSquare className="w-3.5 h-3.5 text-amber-400" /> Goal Check-in
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInputMessage("What memories do you have about me?");
                    setShowQuickActions(false);
                  }}
                  className="px-3 py-2 rounded-xl text-left text-xs text-slate-200 hover:bg-[#162232] hover:text-[#00D9FF] flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Brain className="w-3.5 h-3.5 text-purple-400" /> Memory Recall
                </button>
              </div>
            )}

            {/* Message Input with Integrated Mic */}
            <div className="flex-1 min-w-0 relative flex items-center">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Message Life AI or speak..."
                className="w-full min-w-0 bg-[#101722] border border-[#202B3D] rounded-xl sm:rounded-2xl pl-3 sm:pl-4 pr-10 py-2.5 sm:py-3 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-[#00D9FF] focus:ring-1 focus:ring-[#00D9FF]/30 transition-all shadow-inner"
              />
              <button
                type="button"
                onClick={triggerManualListen}
                title="Tap to speak"
                className={`absolute right-2 sm:right-3 p-1.5 rounded-lg transition-colors cursor-pointer ${
                  voiceState === 'listening'
                    ? 'text-[#00D9FF] bg-[#00D9FF]/20 animate-pulse'
                    : 'text-slate-400 hover:text-[#00D9FF]'
                }`}
              >
                <Mic className="w-4 h-4" />
              </button>
            </div>

            {/* Send Button */}
            <button
              type="submit"
              disabled={!inputMessage.trim() || isSending}
              title="Send message"
              className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-[#00A8FF] to-[#8B5CF6] hover:from-[#00D9FF] hover:to-[#A855F7] disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center shadow-[0_0_16px_rgba(0,168,255,0.4)] transition-all shrink-0 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Rename Conversation Modal */}
      {convToRename && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-sm bg-[#0F1722] border border-[#223147] rounded-2xl p-5 shadow-2xl space-y-4 mx-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-[#00D9FF]" /> Rename Conversation
            </h3>
            <form onSubmit={handleSaveRenameConv} className="space-y-4">
              <input
                type="text"
                value={renameTitleInput}
                onChange={(e) => setRenameTitleInput(e.target.value)}
                placeholder="Conversation title"
                className="w-full bg-[#0A0F18] border border-[#202B3D] rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#00D9FF]"
                autoFocus
                required
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConvToRename(null)}
                  className="px-3 py-1.5 rounded-xl border border-[#223147] bg-[#141E2D] hover:bg-[#1A2639] text-xs font-semibold text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-[#00A8FF] to-[#00D9FF] text-black text-xs font-bold cursor-pointer shadow-md shadow-[#00A8FF]/20"
                >
                  Save Title
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Dialog: Delete Conversation */}
      <ConfirmationDialog
        isOpen={convToDelete !== null}
        title="Delete Conversation"
        message="Are you sure you want to delete this conversation? All messages and contextual memory for this thread will be permanently removed."
        confirmLabel="Delete Conversation"
        cancelLabel="Cancel"
        isDangerous={true}
        onConfirm={handleConfirmDeleteConv}
        onCancel={() => setConvToDelete(null)}
      />
    </div>
  );
};
