export type Role = "youth" | "company";

export type SwipeDecision = "interested" | "skip";

export type MessageSender = "assistant" | "user";

export interface Profile {
  id: string;
  role: Role;
}

export type YouthDocumentType = "grades" | "recommendation" | "certificate" | "cv" | "generated_cv" | "other";

export interface YouthDocument {
  name: string;
  url: string;
  type: YouthDocumentType;
}

export interface YouthProfile {
  user_id: string;
  full_name?: string | null;
  date_of_birth?: string | null;
  address?: string | null;
  postal_code?: string | null;
  additional_addresses?: Array<{ city: string; address: string; postal_code: string }> | null;
  certificates?: string | null;
  extracurriculars?: string | null;
  profile_image_url?: string | null;
  age?: number | null;
  city?: string | null;
  target_roles?: string[] | null;
  skills?: string[] | null;
  interests?: string[] | null;
  working_time?: string[] | null;
  experience?: string | null;
  application_text?: string | null;
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
  cv_uploaded?: boolean | null;
  documents?: YouthDocument[] | null;
  updated_at?: string | null;
  [key: string]: unknown;
}

export interface CompanyProfile {
  user_id: string;
  company_name?: string | null;
  administrator?: string | null;
  description?: string | null;
  city?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
}

export interface JobPost {
  id: string;
  title: string;
  description: string;
  city: string;
  address?: string | null;
  postal_code?: string | null;
  longitude?: number | null;
  latitude?: number | null;
  salary_per_hour: string;
  employment_type: string;
  category: string;
  requirements: string;
  benefits: string;
  company_name: string;
  company_user_id: string;
  image_url: string;
  is_active: boolean;
  created_at: string;
  min_age?: number | null;
  max_age?: number | null;
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
  match_id?: string | null;
  youth_user_id: string;
  company_user_id: string;
  job_id?: string | null;
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
  sender_user_id: string;
  message_text: string;
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
  date_of_birth?: string | null;
  address?: string | null;
  postal_code?: string | null;
  additional_addresses?: Array<{ city: string; address: string; postal_code: string }> | null;
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
  cv_uploaded?: boolean | null;
  documents?: YouthDocument[] | null;
  certificates?: string | null;
  extracurriculars?: string | null;
  profile_image_url?: string | null;
}
