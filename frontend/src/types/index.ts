export interface User {
  id: string;
  email: string;
  username: string;
  full_name?: string;
  preferred_name?: string;
  is_active: boolean;
  is_verified?: boolean;
  avatar_url?: string;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user_id: string;
  username: string;
  email: string;
  is_verified?: boolean;
  avatar_url?: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  audio_url?: string;
  timestamp: string;
  timezone: string;
  local_time_str?: string;
  metadata_json?: {
    sources?: Array<{
      source: string;
      count?: number;
      date?: string;
      records_found?: number;
    }>;
    timing?: {
      router_ms?: number;
      cache_ms?: number;
      profile_ms?: number;
      tools_ms?: number;
      memory_ms?: number;
      document_ms?: number;
      llm_ms?: number;
      total_ms?: number;
      llm_used?: boolean;
      cache_hit?: boolean;
      provider?: string;
      route?: string;
    };
  };
}

export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  messages?: Message[];
}

export interface Memory {
  id: string;
  user_id: string;
  content: string;
  memory_type: 'skill' | 'preference' | 'project' | 'education' | 'achievement' | 'goal' | 'interest' | 'learning' | 'relationship' | 'activity' | 'decision' | 'plan' | 'important_event' | 'personal_fact';
  importance: number;
  confidence: number;
  status: 'active' | 'superseded' | 'archived';
  event_date?: string;
  source_conversation_id?: string;
  last_confirmed_at: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentChunk {
  id: string;
  chunk_index: number;
  content: string;
  page_number?: number;
}

export interface Document {
  id: string;
  user_id: string;
  filename: string;
  original_filename: string;
  file_type: string;
  category: 'pan_card' | 'aadhaar_card' | 'passport' | 'driving_license' | 'resume' | 'certificate' | 'college_document' | 'notes' | 'project_document' | 'other';
  file_size: number;
  extraction_status: 'pending' | 'ocr_processing' | 'embedding' | 'completed' | 'failed';
  error_message?: string;
  extracted_text?: string;
  structured_fields?: Record<string, any>;
  metadata_json?: Record<string, any>;
  created_at: string;
  chunks?: DocumentChunk[];
}

export interface PersonalProfile {
  id: string;
  user_id: string;
  name?: string;
  preferred_name?: string;
  education?: string;
  college?: string;
  degree?: string;
  branch?: string;
  skills: string[];
  programming_languages: string[];
  frameworks: string[];
  tools: string[];
  projects: any[];
  interests: string[];
  goals: string[];
  preferences: Record<string, any>;
  current_focus?: string;
  achievements: string[];
  important_dates: Record<string, string>;
  avatar_url?: string;
  bio?: string;
  batch?: string;
  timezone?: string;
  language?: string;
  theme?: string;
  completion_percentage?: number;
  missing_fields?: string[];
  updated_at: string;
}

export interface DailyActivity {
  id: string;
  user_id: string;
  activity_date: string;
  activity_time?: string;
  title: string;
  description?: string;
  category: string;
  project_tag?: string;
  created_at: string;
}

export interface VaultItem {
  id: string;
  key_name: string;
  item_type: 'pan' | 'aadhaar' | 'passport' | 'bank' | 'api_key' | 'password' | 'other';
  masked_hint?: string;
  decrypted_value?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface GoalMilestone {
  id: string;
  title: string;
  order_index: number;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  deadline?: string;
}

export interface PersonalGoal {
  id: string;
  title: string;
  description?: string;
  category: string;
  priority: number;
  status: 'active' | 'in_progress' | 'completed' | 'paused';
  progress: number;
  deadline?: string;
  target_period?: string;
  created_at: string;
  milestones: GoalMilestone[];
}

export interface StudyTopic {
  id: string;
  name: string;
  status: string;
  mastery_score: number;
  is_weak_spot: boolean;
  weakness_reason?: string;
}

export interface StudySubject {
  id: string;
  name: string;
  category: string;
  overall_progress: number;
  confidence_level: string;
  topics: StudyTopic[];
}

export interface ProductivityMetrics {
  today: {
    study_hours: number;
    coding_hours: number;
    project_hours: number;
    total_hours: number;
    completed_tasks: number;
  };
  this_week: {
    study_hours: number;
    coding_hours: number;
    project_hours: number;
    total_hours: number;
    completed_tasks: number;
  };
  this_month: {
    study_hours: number;
    coding_hours: number;
    project_hours: number;
    total_hours: number;
    completed_tasks: number;
  };
  trend: 'improving' | 'declining' | 'consistent';
  productivity_score: number;
}

export interface DailyBrief {
  id: string;
  brief_type: string;
  brief_date: string;
  summary_yesterday: string[];
  priorities_today: string[];
  urgent_deadlines: string[];
  recommendation?: string;
}

export interface ProactiveInsight {
  id: string;
  insight_type: string;
  title: string;
  reason: string;
  importance: number;
  source: string;
  action_label?: string;
  action_payload?: Record<string, any>;
  created_at?: string;
}

export interface KnowledgeGraphData {
  nodes: Array<{ id: string; name: string; type: string }>;
  edges: Array<{ source: string; target: string; relationship: string; confidence: number; source_provenance: string }>;
}

export type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

export type DetailedVoiceState =
  | 'stopped'
  | 'disabled'
  | 'idle'
  | 'initializing'
  | 'recovering'
  | 'mic_permission'
  | 'starting_mic'
  | 'wake_listening'
  | 'wake_detected'
  | 'greeting'
  | 'user_listening'
  | 'listening'
  | 'speech_detected'
  | 'transcribing'
  | 'processing'
  | 'tts'
  | 'speaking'
  | 'cooldown'
  | 'error';
