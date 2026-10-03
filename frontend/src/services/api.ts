import axios from 'axios';
import {
  AuthResponse,
  Conversation,
  DailyActivity,
  Document,
  Memory,
  PersonalProfile,
  User,
  VaultItem
} from '../types';

export const getServerHostUrl = (): string => {
  if (typeof window !== 'undefined') {
    // 1. Check if running inside Capacitor Android APK (Native Mobile App)
    const isCapacitor = !!(window as any).Capacitor;
    if (isCapacitor || window.location.protocol === 'file:') {
      // In native app, connect to 24/7 Render cloud or user-customized URL
      const customUrl = localStorage.getItem('life_server_url') || localStorage.getItem('jeet_server_url');
      if (customUrl && customUrl.trim() && !customUrl.includes('192.168.1.123') && !customUrl.includes('localhost')) {
        return customUrl.trim().replace(/\/+$/, '').replace(/\/api\/v1$/, '');
      }
      return 'https://life-ai-daoh.onrender.com';
    }

    // 2. Custom server URL from Settings
    const customUrl = localStorage.getItem('life_server_url') || localStorage.getItem('jeet_server_url');
    if (customUrl && customUrl.trim() && !customUrl.includes('192.168.1.123')) {
      return customUrl.trim().replace(/\/+$/, '').replace(/\/api\/v1$/, '');
    }

    // 3. If accessing in browser on laptop localhost
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:8000';
    }

    // 4. If accessed via browser on phone or LAN (e.g. 10.10.202.55:5173)
    if (window.location.hostname) {
      return `http://${window.location.hostname}:8000`;
    }

    return 'http://10.10.202.55:8000';
  }
  return 'http://localhost:8000';
};

export const getApiBaseUrl = (): string => {
  return `${getServerHostUrl()}/api/v1`;
};

export const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 60000
});

// Interceptor to attach JWT token and ensure dynamic baseURL
apiClient.interceptors.request.use((config) => {
  config.baseURL = getApiBaseUrl();
  const token = localStorage.getItem('life_token') || localStorage.getItem('jeet_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const api = {
  // Auth
  register: (data: { email: string; username: string; password: string; full_name?: string }) =>
    apiClient.post<AuthResponse>('/auth/register', data).then(r => r.data),
  login: (data: { username_or_email: string; password: string }) =>
    apiClient.post<AuthResponse>('/auth/login', data).then(r => r.data),
  getMe: () => apiClient.get<User>('/auth/me').then(r => r.data),

  // Chat
  sendMessage: (data: { content: string; conversation_id?: string; timezone?: string; voice_mode?: boolean }) =>
    apiClient.post<{
      response: string;
      conversation_id: string;
      message_id: string;
      audio_url?: string;
      retrieved_sources: any[];
      memories_extracted: string[];
    }>('/chat', data).then(r => r.data),

  getConversations: () =>
    apiClient.get<Conversation[]>('/chat/conversations').then(r => r.data),
  getConversation: (id: string) =>
    apiClient.get<Conversation>(`/chat/conversations/${id}`).then(r => r.data),
  deleteConversation: (id: string) =>
    apiClient.delete(`/chat/conversations/${id}`).then(r => r.data),

  // Memories
  getMemories: (params?: { memory_type?: string; status?: string }) =>
    apiClient.get<Memory[]>('/memories', { params }).then(r => r.data),
  createMemory: (data: { content: string; memory_type: string; importance?: number; confidence?: number; event_date?: string }) =>
    apiClient.post<Memory>('/memories', data).then(r => r.data),
  updateMemory: (id: string, data: Partial<Memory>) =>
    apiClient.patch<Memory>(`/memories/${id}`, data).then(r => r.data),
  deleteMemory: (id: string) =>
    apiClient.delete(`/memories/${id}`).then(r => r.data),
  searchMemories: (query: string, memory_type?: string) =>
    apiClient.post<{ query: string; results: any[] }>('/memories/search', { query, memory_type }).then(r => r.data),

  // Documents
  uploadDocuments: (formData: FormData) =>
    apiClient.post<Document[]>('/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }).then(r => r.data),
  getDocuments: () =>
    apiClient.get<Document[]>('/documents').then(r => r.data),
  getDocument: (id: string) =>
    apiClient.get<Document>(`/documents/${id}`).then(r => r.data),
  deleteDocument: (id: string) =>
    apiClient.delete(`/documents/${id}`).then(r => r.data),
  reprocessDocument: (id: string) =>
    apiClient.post<Document>(`/documents/${id}/reprocess`).then(r => r.data),

  // Profile
  getProfile: () =>
    apiClient.get<PersonalProfile>('/profile').then(r => r.data),
  updateProfile: (data: Partial<PersonalProfile>) =>
    apiClient.patch<PersonalProfile>('/profile', data).then(r => r.data),

  // Timeline
  getTimeline: (params?: { date?: string; project_tag?: string; category?: string }) =>
    apiClient.get<DailyActivity[]>('/timeline', { params }).then(r => r.data),
  addActivity: (data: { activity_date: string; activity_time?: string; title: string; description?: string; category?: string; project_tag?: string }) =>
    apiClient.post<DailyActivity>('/timeline', data).then(r => r.data),
  deleteActivity: (id: string) =>
    apiClient.delete(`/timeline/${id}`).then(r => r.data),

  // Vault
  getVaultItems: () =>
    apiClient.get<VaultItem[]>('/vault').then(r => r.data),
  createVaultItem: (data: { key_name: string; item_type: string; raw_value: string; notes?: string }) =>
    apiClient.post<VaultItem>('/vault', data).then(r => r.data),
  revealVaultItem: (id: string) =>
    apiClient.post<{ id: string; key_name: string; item_type: string; decrypted_value: string; notes?: string }>(`/vault/${id}/reveal`).then(r => r.data),
  deleteVaultItem: (id: string) =>
    apiClient.delete(`/vault/${id}`).then(r => r.data),

  // Voice
  getWakeStatus: () =>
    apiClient.get<{ wake_word: string; status: string; greeting: string; silence_timeout_seconds: number }>('/voice/wake-status').then(r => r.data),
  synthesizeSpeech: (text: string, voice?: string) =>
    apiClient.post<{ audio_url: string }>('/voice/synthesize', { text, voice }).then(r => r.data),

  // Health
  checkHealth: () =>
    apiClient.get('/health').then(r => r.data)
};
