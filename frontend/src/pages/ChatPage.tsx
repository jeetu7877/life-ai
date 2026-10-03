import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { Conversation, Message } from '../types';
import { Send, Mic, Volume2, Sparkles, Clock, Trash2, Plus, Bot, User as UserIcon, MessageSquare, Menu, X } from 'lucide-react';
import { useVoice } from '../context/VoiceContext';

export const ChatPage: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [showMobileHistory, setShowMobileHistory] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { playAudioResponse } = useVoice();

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

  return (
    <div className="flex-1 flex h-full min-h-0 overflow-hidden relative">
      {/* Mobile Drawer Overlay */}
      {showMobileHistory && (
        <div 
          onClick={() => setShowMobileHistory(false)} 
          className="fixed inset-0 bg-black/70 z-40 lg:hidden backdrop-blur-xs"
        />
      )}

      {/* Conversations Drawer / Sidebar (Desktop + Mobile Drawer) */}
      <div className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#0d0d12] border-r border-gray-800/80 flex flex-col shrink-0 transition-transform duration-300 lg:static lg:translate-x-0 ${
        showMobileHistory ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        <div className="p-3 border-b border-gray-800/80 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Conversations</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                handleStartNewChat();
                setShowMobileHistory(false);
              }}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 border border-orange-500/30 flex items-center gap-1 transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> New
            </button>
            <button
              onClick={() => setShowMobileHistory(false)}
              className="lg:hidden p-1.5 rounded-lg text-gray-400 hover:text-white"
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
                  ? 'bg-orange-500/15 border border-orange-500/30 text-orange-300 font-medium'
                  : 'text-gray-400 hover:bg-gray-800/40 hover:text-gray-200'
              }`}
            >
              <div className="truncate flex-1 pr-2">
                <p className="truncate font-medium">{conv.title}</p>
                <span className="text-[10px] text-gray-500">
                  {new Date(conv.created_at).toLocaleDateString()}
                </span>
              </div>
              <button
                onClick={(e) => handleDeleteConv(e, conv.id)}
                className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 p-1 transition-opacity"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {conversations.length === 0 && (
            <div className="p-4 text-center text-xs text-gray-500">No chats yet. Start talking to Life!</div>
          )}
        </div>
      </div>

      {/* Main Chat Stream */}
      <div className="flex-1 flex flex-col min-h-0 h-full overflow-hidden bg-[#09090d] min-w-0">
        {/* Mobile / Header Chat Bar */}
        <div className="h-11 border-b border-gray-800/80 px-4 flex items-center justify-between bg-[#0e0e14] shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowMobileHistory(true)}
              className="lg:hidden p-1.5 rounded-lg border border-gray-800 bg-[#16161f] text-gray-300 hover:text-white flex items-center gap-1.5 text-xs"
            >
              <MessageSquare className="w-3.5 h-3.5 text-orange-400" />
              <span>History ({conversations.length})</span>
            </button>
            <div className="hidden lg:flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="text-xs font-semibold text-gray-200">
                {activeConvId ? (conversations.find(c => c.id === activeConvId)?.title || 'Active Chat') : 'New Conversation'}
              </span>
            </div>
          </div>

          <button
            onClick={handleStartNewChat}
            className="text-xs px-2.5 py-1 rounded-lg bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 border border-orange-500/30 flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Chat</span>
          </button>
        </div>

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="py-8 flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400 shadow-[0_0_20px_rgba(249,115,22,0.2)]">
                <Sparkles className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Chat with Life</h3>
                <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
                  Ask Life about your day, skills, past documents, or talk in Hindi & English.
                </p>
              </div>

              {/* Quick Prompts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full pt-2">
                {[
                  "Hello Life, how are you?",
                  "Aaj maine kya kaam kiya?",
                  "Mere skills summarize karo",
                  "What is my current focus project?"
                ].map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setInputMessage(prompt);
                    }}
                    className="text-xs p-2.5 rounded-xl border border-gray-800 bg-[#14141c] hover:border-orange-500/40 hover:bg-orange-500/10 text-gray-300 text-left transition-all"
                  >
                    "{prompt}"
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, index) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id || index}
                  className={`flex gap-3 max-w-2xl ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
                >
                  <div
                    className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold ${
                      isUser
                        ? 'bg-orange-600 text-white'
                        : 'bg-[#181822] text-orange-400 border border-orange-500/30 shadow-[0_0_10px_rgba(249,115,22,0.2)]'
                    }`}
                  >
                    {isUser ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>

                  <div className="space-y-1 max-w-[85%]">
                    <div
                      className={`p-3.5 rounded-2xl text-sm leading-relaxed ${
                        isUser
                          ? 'bg-orange-500 text-white rounded-tr-none'
                          : 'bg-[#14141a] border border-gray-800 text-gray-200 rounded-tl-none'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>

                    {/* Meta info & source badges */}
                    <div className={`flex items-center gap-2 text-[11px] text-gray-500 ${isUser ? 'justify-end' : 'justify-start'}`}>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {msg.local_time_str || new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>

                      {!isUser && msg.audio_url && (
                        <button
                          onClick={() => playAudioResponse(msg.audio_url!)}
                          className="hover:text-orange-400 flex items-center gap-1 text-[10px] bg-gray-900 px-2 py-0.5 rounded border border-gray-800"
                        >
                          <Volume2 className="w-3 h-3" /> Replay
                        </button>
                      )}

                      {!isUser && msg.metadata_json?.sources && msg.metadata_json.sources.length > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">
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
            <div className="flex gap-3 max-w-2xl mr-auto items-center text-xs text-orange-400">
              <div className="w-8 h-8 rounded-full bg-[#181822] border border-orange-500/30 flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              <div className="p-3 rounded-2xl bg-[#14141a] border border-gray-800 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping" />
                Life is thinking & searching memories...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Pinned Bottom Input Bar */}
        <div className="shrink-0 p-3 sm:p-4 pb-20 md:pb-4 border-t border-white/[0.08] bg-[#0c0c14]/95 backdrop-blur-xl z-20">
          <form onSubmit={handleSend} className="max-w-4xl mx-auto flex items-center gap-2">
            <div className="flex-1 relative flex items-center">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Ask Life about your day, skills, past documents, or talk in Hindi & English..."
                className="w-full bg-[#13131c] border border-white/[0.1] rounded-2xl px-4 py-3 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all shadow-inner"
              />
            </div>
            <button
              type="submit"
              disabled={!inputMessage.trim() || isSending}
              className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center shadow-[0_0_15px_rgba(249,115,22,0.3)] transition-all shrink-0 cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
