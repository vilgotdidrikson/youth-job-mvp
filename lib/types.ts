export type Role = "youth" | "company";

export type SwipeDecision = "interested" | "skip";

export type MessageSender = "assistant" | "user";

export interface Profile {
  id: string;
  role: Role;
}

export interface YouthProfile {
  user_id: string;
  full_name?: string | null;
  age?: number | null;
  city?: string | null;
  merits?: string[] | null;
  strengths?: string[] | null;
  work_experience?: string[] | null;
  education?: string[] | null;
  languages?: string[] | null;
  desired_roles?: string[] | null;
  desired_locations?: string[] | null;
  employment_preferences?: string[] | null;
  cv_text?: string | null;
  cover_letter_template?: string | null;
  onboarding_completed?: boolean | null;
  cv_generated?: boolean | null;
  skills?: string[] | null;
  interests?: string[] | null;
  working_time?: string[] | null;
  experience?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
}

export interface CompanyProfile {
  user_id: string;
  company_name?: string | null;
  description?: string | null;
  city?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
}

export interface JobPost {
  id: string;
  company_user_id: string;
  company_name?: string | null;
  title: string;
  city?: string | null;
  job_type?: string | null;
  pay?: string | null;
  description?: string | null;
  tags?: string[] | null;
  image_url?: string | null;
  category?: string | null;
  is_active?: boolean | null;
  active?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
}

export interface JobInterest {
  id?: string;
  youth_user_id: string;
  job_id: string;
  decision: SwipeDecision;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
}

export interface CandidateReview {
  id?: string;
  company_user_id: string;
  youth_user_id: string;
  job_id: string;
  decision: SwipeDecision;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
}

export interface MatchRecord {
  id: string;
  youth_user_id: string;
  company_user_id: string;
  job_id: string;
  conversation_id?: string | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
}

export interface Conversation {
  id: string;
  youth_user_id: string;
  company_user_id: string;
  last_message_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
}

export interface ConversationSummary extends Conversation {
  job_id?: string | null;
  match_id?: string | null;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_user_id?: string | null;
  sender?: string | null;
  text?: string | null;
  body?: string | null;
  created_at?: string | null;
  [key: string]: unknown;
}

export interface OnboardingSession {
  id: string;
  youth_user_id: string;
  status?: string | null;
  completed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
}

export interface OnboardingMessage {
  id: string;
  session_id: string;
  sender: MessageSender;
  message_text: string;
  created_at?: string | null;
  [key: string]: unknown;
}

export interface CandidateFeedItem {
  youthUserId: string;
  profile: YouthProfile | null;
  job: JobPost;
}

export interface SaveYouthProfileInput {
  full_name?: string | null;
  age?: number | null;
  city?: string | null;
  merits?: string[] | null;
  strengths?: string[] | null;
  work_experience?: string[] | null;
  education?: string[] | null;
  languages?: string[] | null;
  desired_roles?: string[] | null;
  desired_locations?: string[] | null;
  employment_preferences?: string[] | null;
  cv_text?: string | null;
  cover_letter_template?: string | null;
  onboarding_completed?: boolean | null;
  cv_generated?: boolean | null;
  skills?: string[] | null;
  interests?: string[] | null;
  working_time?: string[] | null;
  experience?: string | null;
}
