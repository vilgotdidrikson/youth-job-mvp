export type Role = "youth" | "company";

export interface Profile {
  id: string;
  role: Role;
}

export type SwipeDecision = "interested" | "skip";

export interface YouthCvProfile {
  user_id: string;
  full_name: string;
  age: number | null;
  city: string;
  target_roles: string[];
  skills: string[];
  interests: string[];
  working_time: string[];
  experience: string;
  cv_text: string;
  application_text: string;
  updated_at?: string;
}

export interface JobPost {
  id: string;
  company_user_id: string;
  company_name?: string;
  title: string;
  city: string;
  job_type: "part-time" | "summer" | "weekend" | "extra";
  pay: string;
  description: string;
  tags?: string[];
  is_active: boolean;
  created_at?: string;
}

export interface SwipeAction {
  id: string;
  youth_user_id: string;
  job_id: string;
  decision: SwipeDecision;
  created_at?: string;
}

export interface MatchRecord {
  id: string;
  youth_user_id: string;
  company_user_id: string;
  job_id: string;
  status: "matched";
  created_at?: string;
}

export interface Conversation {
  id: string;
  match_id: string;
  youth_user_id: string;
  company_user_id: string;
  job_id: string;
  last_message_at?: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_user_id: string;
  body: string;
  created_at?: string;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: {
          id: string;
          role: Role;
        };
        Update: {
          id?: string;
          role?: Role;
        };
        Relationships: [];
      };
      youth_profiles: {
        Row: {
          user_id: string;
        };
        Insert: {
          user_id: string;
        };
        Update: {
          user_id?: string;
        };
        Relationships: [];
      };
      company_profiles: {
        Row: {
          user_id: string;
        };
        Insert: {
          user_id: string;
        };
        Update: {
          user_id?: string;
        };
        Relationships: [];
      };
      youth_cv_profiles: {
        Row: YouthCvProfile;
        Insert: YouthCvProfile;
        Update: Partial<YouthCvProfile>;
        Relationships: [];
      };
      jobs: {
        Row: JobPost;
        Insert: Omit<JobPost, "id"> & { id?: string };
        Update: Partial<JobPost>;
        Relationships: [];
      };
      swipe_actions: {
        Row: SwipeAction;
        Insert: Omit<SwipeAction, "id"> & { id?: string };
        Update: Partial<SwipeAction>;
        Relationships: [];
      };
      matches: {
        Row: MatchRecord;
        Insert: Omit<MatchRecord, "id"> & { id?: string };
        Update: Partial<MatchRecord>;
        Relationships: [];
      };
      conversations: {
        Row: Conversation;
        Insert: Omit<Conversation, "id"> & { id?: string };
        Update: Partial<Conversation>;
        Relationships: [];
      };
      messages: {
        Row: ChatMessage;
        Insert: Omit<ChatMessage, "id"> & { id?: string };
        Update: Partial<ChatMessage>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
