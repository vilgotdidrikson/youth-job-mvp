export type Role = "youth" | "company" | "admin";

export type JobType = "part-time" | "temporary" | "summer";

export type YouthJobActionType = "interested" | "skip";

export type CompanyDecisionState = "accept" | "reject";

export type OnboardingStep =
  | "name"
  | "age"
  | "city"
  | "targetRole"
  | "interests"
  | "skills"
  | "availability"
  | "experience";

export type NotificationType =
  | "match"
  | "profile_view"
  | "interest"
  | "decision";

export interface User {
  id: string;
  email: string;
  password: string;
  role: Role;
  createdAt: string;
}

export interface CVData {
  summary: string;
  content: string;
  language?: "sv" | "en";
  tone?: "professional" | "friendly" | "confident";
  targetRole?: string;
  qualityScore?: number;
  highlights?: string[];
  keywords?: string[];
  suggestions?: string[];
  updatedAt: string;
}

export interface YouthProfile {
  userId: string;
  name: string;
  age: number | null;
  city: string;
  targetRole: string;
  skills: string[];
  interests: string[];
  experience: string[];
  availability: string;
  premiumBadge: boolean;
  cv: CVData | null;
  updatedAt: string;
}

export interface CompanyProfile {
  userId: string;
  companyName: string;
  city: string;
  description: string;
  tier: "free" | "premium";
  updatedAt: string;
}

export interface JobListing {
  id: string;
  companyId: string;
  title: string;
  description: string;
  location: string;
  jobType: JobType;
  active: boolean;
  createdAt: string;
}

export interface YouthJobAction {
  id: string;
  youthId: string;
  jobId: string;
  action: YouthJobActionType;
  createdAt: string;
}

export interface CompanyDecision {
  id: string;
  companyId: string;
  youthId: string;
  jobId: string;
  decision: CompanyDecisionState;
  createdAt: string;
}

export interface MatchRecord {
  id: string;
  companyId: string;
  youthId: string;
  jobId: string;
  createdAt: string;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  type: NotificationType;
  message: string;
  read: boolean;
  metadata?: string;
  createdAt: string;
}

export interface Database {
  users: User[];
  youthProfiles: YouthProfile[];
  companyProfiles: CompanyProfile[];
  jobs: JobListing[];
  youthActions: YouthJobAction[];
  companyDecisions: CompanyDecision[];
  matches: MatchRecord[];
  notifications: NotificationRecord[];
}

export interface PublicUser {
  id: string;
  email: string;
  role: Role;
}

export type SessionUser = PublicUser;
