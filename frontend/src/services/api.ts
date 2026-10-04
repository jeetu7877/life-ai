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
    apiClient.post<{ success: boolean; message: string; email: string; requires_otp: boolean; expires_in_seconds: number }>('/auth/register', data).then(r => r.data),
  login: (data: { username_or_email: string; password: string }) =>
    apiClient.post<AuthResponse>('/auth/login', data).then(r => r.data),
  verifyOtp: (data: { email: string; otp: string }) =>
    apiClient.post<AuthResponse>('/auth/verify-otp', data).then(r => r.data),
  resendOtp: (email: string) =>
    apiClient.post<{ success: boolean; message: string; resend_cooldown_seconds?: number }>('/auth/resend-otp', { email }).then(r => r.data),
  getMe: () => apiClient.get<User>('/auth/me').then(r => r.data),
  verifyEmail: (token: string) =>
    apiClient.post<{ message: string; user: any }>('/auth/verify-email', { token }).then(r => r.data),
  resendVerification: (email: string) =>
    apiClient.post<{ message: string }>('/auth/resend-verification', { email }).then(r => r.data),
  changePassword: (data: { current_password: string; new_password: string }) =>
    apiClient.post<{ message: string }>('/auth/change-password', data).then(r => r.data),
  deleteAccount: (password: string) =>
    apiClient.post<{ message: string }>('/auth/account', { password }).then(r => r.data),
  exportData: () =>
    apiClient.get<any>('/auth/export-data').then(r => r.data),

  // Chat
  sendMessage: (data: { content: string; conversation_id?: string; timezone?: string; voice_mode?: boolean }) =>
    apiClient.post<{
      response: string;
      conversation_id: string;
      message_id: string;
      audio_url?: string;
      retrieved_sources: any[];
      memories_extracted: string[];
      timing?: Record<string, any>;
    }>('/chat', data).then(r => r.data),

  getConversations: () =>
    apiClient.get<Conversation[]>('/chat/conversations').then(r => r.data),
  getConversation: (id: string) =>
    apiClient.get<Conversation>(`/chat/conversations/${id}`).then(r => r.data),
  renameConversation: (id: string, title: string) =>
    apiClient.patch<Conversation>(`/chat/conversations/${id}`, { title }).then(r => r.data),
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
  uploadAvatar: (formData: FormData) =>
    apiClient.post<{ avatar_url: string; message: string }>('/profile/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }).then(r => r.data),
  removeAvatar: () =>
    apiClient.delete<{ message: string }>('/profile/avatar').then(r => r.data),

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

  // Voice & STT
  getWakeStatus: () =>
    apiClient.get<{ wake_word: string; status: string; greeting: string; silence_timeout_seconds: number }>('/voice/wake-status').then(r => r.data),
  synthesizeSpeech: (text: string, voice?: string) =>
    apiClient.post<{ audio_url: string }>('/voice/synthesize', { text, voice }).then(r => r.data),
  transcribeAudio: (audioBlob: Blob) => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'speech.webm');
    return apiClient.post<{ transcript: string }>('/voice/transcribe', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }).then(r => r.data);
  },
  transcribeAndRespond: (audioBlob: Blob, timezone?: string) => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'speech.webm');
    if (timezone) formData.append('timezone', timezone);
    return apiClient.post<{ transcript: string; response: string; audio_url?: string; conversation_id?: string }>('/voice/transcribe-and-respond', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }).then(r => r.data);
  },

  // GitHub
  getGitHubStatus: () =>
    apiClient.get<{ is_connected: boolean; username?: string; indexed_repositories_count: number; indexed_repositories: any[] }>('/github/status').then(r => r.data),
  connectGitHub: (token: string, username?: string) =>
    apiClient.post<{ status: string; provider: string; username?: string; is_active: boolean }>('/github/connect', { token, username }).then(r => r.data),
  listGitHubRepos: () =>
    apiClient.get<{ repositories: any[] }>('/github/repos').then(r => r.data),
  indexGitHubRepo: (repo_name: string, owner?: string, branch?: string) =>
    apiClient.post<{ success: boolean; repository: string; files_count: number; chunks_indexed: number }>('/github/index', { repo_name, owner, branch }).then(r => r.data),
  indexAllGitHubRepos: () =>
    apiClient.post<{ success: boolean; total_repos_found: number; repos_indexed: number; total_chunks_indexed: number; details: any[] }>('/github/index-all').then(r => r.data),
  searchGitHubCode: (query: string, repo_name?: string, top_k: number = 5) =>
    apiClient.post<{ results: any[]; count: number }>('/github/search', { query, repo_name, top_k }).then(r => r.data),

  // Goals & Tasks
  getGoals: () =>
    apiClient.get<any[]>('/goals').then(r => r.data),
  createGoal: (data: { title: string; description?: string; category?: string; priority?: number; target_period_months?: number }) =>
    apiClient.post('/goals', data).then(r => r.data),
  getGoalRecommendation: () =>
    apiClient.get<{ has_action: boolean; recommendation: string; goal?: string; next_milestone?: string; top_task?: string }>('/goals/recommendation').then(r => r.data),
  updateMilestoneStatus: (milestoneId: string, status: string) =>
    apiClient.post(`/goals/milestones/${milestoneId}/status`, { status }).then(r => r.data),

  // Study Coach
  getStudySubjects: () =>
    apiClient.get<any[]>('/study/subjects').then(r => r.data),
  createStudyRoadmap: (subject_name: string, category?: string) =>
    apiClient.post('/study/roadmap', { subject_name, category }).then(r => r.data),
  getWeakTopics: (subject?: string) =>
    apiClient.get<any[]>('/study/weak-topics', { params: { subject } }).then(r => r.data),

  // Analytics & Daily Brief
  getAnalyticsMetrics: () =>
    apiClient.get<any>('/analytics/metrics').then(r => r.data),
  getDailyBrief: (brief_type: string = 'morning') =>
    apiClient.get<any>('/analytics/brief', { params: { brief_type } }).then(r => r.data),

  // Proactive Insights
  getProactiveInsights: () =>
    apiClient.get<any[]>('/proactive/insights').then(r => r.data),
  dismissProactiveInsight: (id: string) =>
    apiClient.post(`/proactive/insights/${id}/dismiss`).then(r => r.data),

  // Knowledge Graph
  getKnowledgeGraph: () =>
    apiClient.get<any>('/knowledge-graph').then(r => r.data),

  // Unique Intelligence Suite
  getLifeTwinState: () =>
    apiClient.get<any>('/life-twin').then(r => r.data),
  createLifeTwinSnapshot: () =>
    apiClient.post<any>('/life-twin/snapshot').then(r => r.data),
  getLifeTwinComparison: () =>
    apiClient.get<any>('/life-twin/comparison').then(r => r.data),

  runWhatIfSimulation: (query: string) =>
    apiClient.post<any>('/simulations/what-if', { query }).then(r => r.data),
  runDecisionDebate: (data: { option_a: string; option_b: string; decision_context?: string }) =>
    apiClient.post<any>('/simulations/decision-debate', data).then(r => r.data),
  getBottlenecks: () =>
    apiClient.get<any>('/simulations/bottlenecks').then(r => r.data),

  getTimeMachineReconstruction: (query: string) =>
    apiClient.get<any>('/time-machine/query', { params: { query } }).then(r => r.data),
  getWeeklyReflection: () =>
    apiClient.get<any>('/time-machine/weekly-reflection').then(r => r.data),

  getProjectHealth: (projectName?: string) =>
    apiClient.get<any>('/intelligence/project-health', { params: { project_name: projectName } }).then(r => r.data),
  getPersonalRisks: () =>
    apiClient.get<any[]>('/intelligence/risks').then(r => r.data),
  getPatterns: () =>
    apiClient.get<any[]>('/intelligence/patterns').then(r => r.data),
  getMemoryConflicts: () =>
    apiClient.get<any[]>('/intelligence/memory-conflicts').then(r => r.data),

  getJournalEntries: (category?: string) =>
    apiClient.get<any[]>('/journal', { params: { category } }).then(r => r.data),
  createJournalEntry: (data: { title?: string; content: string; category?: string; entry_date?: string }) =>
    apiClient.post<any>('/journal', data).then(r => r.data),
  promoteJournalEntry: (id: string) =>
    apiClient.post<any>(`/journal/${id}/promote`).then(r => r.data),

  // Health
  checkHealth: () =>
    apiClient.get('/health').then(r => r.data)
};
