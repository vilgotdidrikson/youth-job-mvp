"use client";

import { getCurrentUser, getUserProfile } from "@/lib/auth";
import { getSupabaseClient } from "@/lib/supabase";
import type { JobPost } from "@/lib/types";

export interface CreateJobInput {
  title: string;
  city: string;
  pay: string;
  job_type: string;
  description: string;
  company_name?: string | null;
  image_url?: string | null;
  category?: string | null;
  tags?: string[];
}

export interface UpdateJobInput extends Partial<CreateJobInput> {
  is_active?: boolean;
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function normalizeJob(row: Record<string, unknown>): JobPost {
  return {
    ...row,
    id: String(row.id ?? ""),
    company_user_id: String(row.company_user_id ?? ""),
    company_name: typeof row.company_name === "string" ? row.company_name : null,
    title: typeof row.title === "string" ? row.title : "",
    city: typeof row.city === "string" ? row.city : null,
    job_type: typeof row.job_type === "string" ? row.job_type : null,
    pay: typeof row.pay === "string" ? row.pay : null,
    description: typeof row.description === "string" ? row.description : null,
    tags: normalizeStringArray(row.tags),
    image_url: typeof row.image_url === "string" ? row.image_url : null,
    category: typeof row.category === "string" ? row.category : null,
    is_active:
      typeof row.is_active === "boolean"
        ? row.is_active
        : typeof row.active === "boolean"
          ? row.active
          : true,
  };
}

function isActiveJob(job: JobPost): boolean {
  if (typeof job.is_active === "boolean") {
    return job.is_active;
  }

  if (typeof job.active === "boolean") {
    return job.active;
  }

  return true;
}

function isMissingColumnError(error: { message?: string } | null, column: string): boolean {
  return Boolean(error?.message?.includes(`Could not find the '${column}' column`));
}

async function assertCompanyUser(): Promise<string> {
  const user = await getCurrentUser();
  const profile = await getUserProfile(user?.id);

  if (!user || profile?.role !== "company") {
    throw new Error("Only company accounts can manage jobs.");
  }

  return user.id;
}

async function insertJobRow(payload: Record<string, unknown>) {
  const supabase = getSupabaseClient();
  const primaryPayload = { ...payload, is_active: true };
  const { data, error } = await supabase.from("jobs").insert(primaryPayload).select("*").single();

  if (!error && data) {
    return normalizeJob(data as Record<string, unknown>);
  }

  if (!isMissingColumnError(error, "is_active")) {
    console.error("Failed to insert job row.", error);
    throw new Error(error?.message ?? "Unable to create job.");
  }

  const fallbackPayload = { ...payload };
  const { data: fallbackData, error: fallbackError } = await supabase
    .from("jobs")
    .insert(fallbackPayload)
    .select("*")
    .single();

  if (fallbackError || !fallbackData) {
    console.error("Failed to insert job row.", fallbackError);
    throw new Error(fallbackError?.message ?? "Unable to create job.");
  }

  return normalizeJob(fallbackData as Record<string, unknown>);
}

async function updateJobRow(jobId: string, updates: Record<string, unknown>) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("jobs").update(updates).eq("id", jobId).select("*").single();

  if (!error && data) {
    return normalizeJob(data as Record<string, unknown>);
  }

  if ("is_active" in updates && isMissingColumnError(error, "is_active")) {
    const fallbackUpdates = Object.fromEntries(Object.entries(updates).filter(([key]) => key !== "is_active"));
    const { data: fallbackData, error: fallbackError } = await supabase
      .from("jobs")
      .update(fallbackUpdates)
      .eq("id", jobId)
      .select("*")
      .single();

    if (!fallbackError && fallbackData) {
      return normalizeJob(fallbackData as Record<string, unknown>);
    }

    console.error("Failed to update job row.", fallbackError);
    throw new Error(fallbackError?.message ?? "Unable to update job.");
  }

  console.error("Failed to update job row.", error);
  throw new Error(error?.message ?? "Unable to update job.");
}

export async function getJobs(includeInactive = false): Promise<JobPost[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("jobs").select("*").order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch jobs.", error);
    throw new Error(error.message);
  }

  const jobs = (data ?? []).map((row) => normalizeJob(row as Record<string, unknown>));
  return includeInactive ? jobs : jobs.filter(isActiveJob);
}

export async function getJobById(jobId: string): Promise<JobPost | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("jobs").select("*").eq("id", jobId).maybeSingle();

  if (error) {
    console.error("Failed to fetch job.", error);
    throw new Error(error.message);
  }

  return data ? normalizeJob(data as Record<string, unknown>) : null;
}

export async function createJob(jobData: CreateJobInput): Promise<JobPost> {
  const companyUserId = await assertCompanyUser();

  return insertJobRow({
    company_user_id: companyUserId,
    company_name: jobData.company_name ?? null,
    title: jobData.title,
    city: jobData.city,
    pay: jobData.pay,
    job_type: jobData.job_type,
    description: jobData.description,
    image_url: jobData.image_url ?? null,
    category: jobData.category ?? jobData.job_type ?? null,
    tags: jobData.tags ?? [],
  });
}

export async function updateJob(jobId: string, updates: UpdateJobInput): Promise<JobPost> {
  const companyUserId = await assertCompanyUser();
  const existing = await getJobById(jobId);

  if (!existing) {
    throw new Error("Job not found.");
  }

  if (existing.company_user_id !== companyUserId) {
    throw new Error("You can only update your own jobs.");
  }

  return updateJobRow(jobId, {
    ...updates,
    category: updates.category ?? updates.job_type ?? existing.category ?? null,
  });
}

export async function deleteJob(jobId: string): Promise<void> {
  const companyUserId = await assertCompanyUser();
  const existing = await getJobById(jobId);

  if (!existing) {
    throw new Error("Job not found.");
  }

  if (existing.company_user_id !== companyUserId) {
    throw new Error("You can only delete your own jobs.");
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.from("jobs").delete().eq("id", jobId);

  if (error) {
    console.error("Failed to delete job.", error);
    throw new Error(error.message);
  }
}

export async function getCompanyJobs(companyUserId?: string, includeInactive = true): Promise<JobPost[]> {
  const ownerId = companyUserId ?? (await assertCompanyUser());
  const jobs = await getJobs(includeInactive);
  return jobs.filter((job) => job.company_user_id === ownerId);
}
