export interface User {
  id: string;
  email: string;
  username: string;
  full_name?: string;
  preferred_name?: string;
  is_active: boolean;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user_id: string;
  username: string;
  email: string;
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

export type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

export type DetailedVoiceState =
  | 'stopped'
  | 'wake_listening'
  | 'wake_detected'
  | 'greeting'
  | 'user_listening'
  | 'processing'
  | 'tts'
  | 'cooldown'
  | 'error';
