"use client";

import { getCurrentUser, getUserProfile } from "@/lib/auth";
import { getSupabaseErrorMessage, logSupabaseError } from "@/lib/supabase-errors";
import { getSupabaseClient } from "@/lib/supabase";
import { geocodeJobLocation } from "@/lib/job-location";
import type { JobPost } from "@/lib/types";

const JOB_TABLE_FIELDS = [
  "title",
  "description",
  "city",
  "address",
  "postal_code",
  "longitude",
  "latitude",
  "salary_per_hour",
  "employment_type",
  "category",
  "requirements",
  "benefits",
  "company_name",
  "company_user_id",
  "image_url",
  "job_kind",
  "is_active",
  "status",
  "open_positions",
  "created_at",
  "min_age",
  "max_age",
] as const;

const JOB_CREATE_INPUT_FIELDS = [
  "title",
  "description",
  "city",
  "address",
  "postal_code",
  "longitude",
  "latitude",
  "salary_per_hour",
  "employment_type",
  "category",
  "requirements",
  "benefits",
  "company_name",
  "image_url",
  "job_kind",
  "open_positions",
  "min_age",
  "max_age",
] as const;

const JOB_UPDATE_INPUT_FIELDS = [...JOB_CREATE_INPUT_FIELDS, "is_active", "status"] as const;
const JOB_INSERT_FIELDS = [...JOB_CREATE_INPUT_FIELDS, "company_user_id", "is_active"] as const;
const JOB_PROTECTED_CREATE_FIELDS = ["company_user_id", "is_active", "created_at"] as const;
const JOB_PROTECTED_UPDATE_FIELDS = ["company_user_id", "created_at"] as const;

export interface CreateJobInput {
  title: string;
  description: string;
  city: string;
  address?: string | null;
  postal_code?: string | null;
  longitude?: number | null;
  latitude?: number | null;
  salary_per_hour: string;
  employment_type: string;
  category?: string | null;
  requirements?: string | null;
  benefits?: string | null;
  company_name?: string | null;
  image_url?: string | null;
  job_kind?: "employment" | "private_task";
  open_positions?: number | null;
  min_age?: number | null;
  max_age?: number | null;
}

export interface UpdateJobInput extends Partial<CreateJobInput> {
  is_active?: boolean;
  status?: "active" | "paused" | "closed";
}

interface JobInsertPayload {
  title: string;
  description: string;
  city: string;
  address: string;
  postal_code: string;
  longitude: number | null;
  latitude: number | null;
  salary_per_hour: string;
  employment_type: string;
  category: string;
  requirements: string;
  benefits: string;
  company_name: string;
  company_user_id: string;
  image_url: string;
  job_kind: "employment" | "private_task";
  is_active: boolean;
  status: "active" | "paused" | "closed";
  open_positions: number;
  min_age?: number | null;
  max_age?: number | null;
}

function normalizeJobString(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return "";
}

function validCoordinates(longitude: unknown, latitude: unknown): longitude is number {
  return typeof longitude === "number"
    && Number.isFinite(longitude)
    && typeof latitude === "number"
    && Number.isFinite(latitude)
    && longitude >= -180
    && longitude <= 180
    && latitude >= -90
    && latitude <= 90;
}

function toRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function stripUndefinedValues(payload: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
}

function throwJobFieldMismatch(invalidFields: string[]): never {
  for (const field of invalidFields) {
    console.error(`FIELD MISMATCH: '${field}' does not exist in jobs table`);
  }

  throw new Error(
    `Invalid jobs field${invalidFields.length === 1 ? "" : "s"}: ${invalidFields
      .map((field) => `'${field}'`)
      .join(", ")}. Valid fields: ${JOB_TABLE_FIELDS.join(", ")}`,
  );
}

function throwProtectedJobFieldError(field: string, validFields: readonly string[]): never {
  console.error(`FIELD MISMATCH: '${field}' is managed by the jobs table`);
  throw new Error(
    `Invalid jobs field '${field}' for this operation. Valid user-supplied fields: ${validFields.join(", ")}`,
  );
}

function assertOnlyKnownJobFields(payload: Record<string, unknown>): void {
  const invalidFields = Object.keys(payload).filter(
    (field) => !JOB_TABLE_FIELDS.includes(field as (typeof JOB_TABLE_FIELDS)[number]),
  );

  if (invalidFields.length) {
    throwJobFieldMismatch(invalidFields);
  }
}

function assertNoProtectedFields(
  payload: Record<string, unknown>,
  protectedFields: readonly string[],
  validFields: readonly string[],
): void {
  const blockedField = protectedFields.find((field) => field in payload);

  if (blockedField) {
    throwProtectedJobFieldError(blockedField, validFields);
  }
}

function assertAllowedJobCreateInput(payload: Record<string, unknown>): void {
  assertOnlyKnownJobFields(payload);
  assertNoProtectedFields(payload, JOB_PROTECTED_CREATE_FIELDS, JOB_CREATE_INPUT_FIELDS);

  const invalidFields = Object.keys(payload).filter(
    (field) => !JOB_CREATE_INPUT_FIELDS.includes(field as (typeof JOB_CREATE_INPUT_FIELDS)[number]),
  );

  if (invalidFields.length) {
    throwJobFieldMismatch(invalidFields);
  }
}

function assertAllowedJobUpdateInput(payload: Record<string, unknown>): void {
  assertOnlyKnownJobFields(payload);
  assertNoProtectedFields(payload, JOB_PROTECTED_UPDATE_FIELDS, JOB_UPDATE_INPUT_FIELDS);

  const invalidFields = Object.keys(payload).filter(
    (field) => !JOB_UPDATE_INPUT_FIELDS.includes(field as (typeof JOB_UPDATE_INPUT_FIELDS)[number]),
  );

  if (invalidFields.length) {
    throwJobFieldMismatch(invalidFields);
  }
}

function assertValidInsertPayload(payload: Record<string, unknown>): void {
  const invalidFields = Object.keys(payload).filter(
    (field) => !JOB_INSERT_FIELDS.includes(field as (typeof JOB_INSERT_FIELDS)[number]),
  );

  if (invalidFields.length) {
    throwJobFieldMismatch(invalidFields);
  }
}

function normalizeJob(row: Record<string, unknown>): JobPost {
  return {
    id: String(row.id ?? ""),
    title: normalizeJobString(row.title),
    description: normalizeJobString(row.description),
    city: normalizeJobString(row.city),
    address: normalizeJobString(row.address),
    postal_code: normalizeJobString(row.postal_code),
    longitude: typeof row.longitude === "number" ? row.longitude : null,
    latitude: typeof row.latitude === "number" ? row.latitude : null,
    salary_per_hour: normalizeJobString(row.salary_per_hour),
    employment_type: normalizeJobString(row.employment_type),
    category: normalizeJobString(row.category),
    requirements: normalizeJobString(row.requirements),
    benefits: normalizeJobString(row.benefits),
    company_name: normalizeJobString(row.company_name),
    company_user_id: String(row.company_user_id ?? ""),
    image_url: normalizeJobString(row.image_url),
    job_kind: row.job_kind === "private_task" ? "private_task" : "employment",
    is_active: typeof row.is_active === "boolean" ? row.is_active : true,
    status: row.status === "paused" || row.status === "closed" ? row.status : "active",
    open_positions: typeof row.open_positions === "number" ? row.open_positions : 1,
    created_at: normalizeJobString(row.created_at),
    min_age: typeof row.min_age === "number" ? row.min_age : null,
    max_age: typeof row.max_age === "number" ? row.max_age : null,
  };
}

function isActiveJob(job: JobPost): boolean {
  return job.is_active !== false;
}

async function assertCompanyUser(): Promise<{ id: string; email: string | null }> {
  const user = await getCurrentUser();
  const profile = await getUserProfile(user?.id);

  if (!user?.id || (profile?.role !== "company" && profile?.role !== "private")) {
    throw new Error("Only company and private accounts can manage jobs.");
  }

  return { id: user.id, email: user.email ?? null };
}

function buildJobUpdatePayload(updates: UpdateJobInput): Record<string, unknown> {
  return stripUndefinedValues({
    title: updates.title,
    description: updates.description,
    city: updates.city,
    address: updates.address,
    postal_code: updates.postal_code,
    longitude: updates.longitude,
    latitude: updates.latitude,
    salary_per_hour: updates.salary_per_hour,
    employment_type: updates.employment_type,
    category: updates.category,
    requirements: updates.requirements,
    benefits: updates.benefits,
    company_name: updates.company_name,
    image_url: updates.image_url,
    job_kind: updates.job_kind,
    is_active: updates.is_active,
    status: updates.status,
    open_positions: updates.open_positions,
    min_age: updates.min_age,
    max_age: updates.max_age,
  });
}

async function insertJobRow(payload: JobInsertPayload) {
  assertValidInsertPayload(toRecord(payload));

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("jobs").insert(payload).select("*").single();

  if (error || !data) {
    logSupabaseError("jobs.insert", error ?? new Error("Supabase returned no job row after insert."), payload);
    throw new Error(getSupabaseErrorMessage(error, "Unable to create job."));
  }

  return normalizeJob(data as Record<string, unknown>);
}

async function updateJobRow(jobId: string, updates: Record<string, unknown>) {
  assertOnlyKnownJobFields(updates);

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("jobs").update(updates).eq("id", jobId).select("*").single();

  if (error || !data) {
    logSupabaseError("jobs.update", error ?? new Error("Supabase returned no job row after update."), {
      jobId,
      updates,
    });
    throw new Error(getSupabaseErrorMessage(error, "Unable to update job."));
  }

  return normalizeJob(data as Record<string, unknown>);
}

export async function getJobs(includeInactive = false): Promise<JobPost[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("jobs").select("*").order("created_at", { ascending: false });

  if (error) {
    logSupabaseError("jobs.select.all", error);
    throw new Error(getSupabaseErrorMessage(error, "Unable to fetch jobs."));
  }

  const jobs = (data ?? []).map((row) => normalizeJob(row as Record<string, unknown>));
  return includeInactive ? jobs : jobs.filter(isActiveJob);
}

export async function getJobById(jobId: string): Promise<JobPost | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("jobs").select("*").eq("id", jobId).maybeSingle();

  if (error) {
    logSupabaseError("jobs.select.by_id", error, { jobId });
    throw new Error(getSupabaseErrorMessage(error, "Unable to fetch job."));
  }

  return data ? normalizeJob(data as Record<string, unknown>) : null;
}

export async function createJob(jobData: CreateJobInput): Promise<JobPost> {
  assertAllowedJobCreateInput(toRecord(jobData));

  const hasAddress = Boolean(jobData.address?.trim());
  const hasCoordinates = validCoordinates(jobData.longitude, jobData.latitude);
  if (!hasAddress && !hasCoordinates) {
    throw new Error("Ange en arbetsplatsadress eller giltiga koordinater.");
  }
  if ((jobData.longitude != null || jobData.latitude != null) && !hasCoordinates) {
    throw new Error("Koordinater måste innehålla både giltig longitud och latitud.");
  }

  const companyUser = await assertCompanyUser();
  const coordinates = hasCoordinates
    ? { longitude: jobData.longitude, latitude: jobData.latitude }
    : await geocodeJobLocation({
      address: jobData.address,
      postalCode: jobData.postal_code,
      city: jobData.city,
    });

  const payload: JobInsertPayload = {
    title: jobData.title,
    description: jobData.description,
    city: jobData.city,
    address: jobData.address?.trim() ?? "",
    postal_code: jobData.postal_code?.trim() ?? "",
    longitude: coordinates?.longitude ?? null,
    latitude: coordinates?.latitude ?? null,
    salary_per_hour: jobData.salary_per_hour,
    employment_type: jobData.employment_type,
    category: jobData.category ?? jobData.employment_type,
    requirements: jobData.requirements ?? "",
    benefits: jobData.benefits ?? "",
    company_name: jobData.company_name ?? companyUser.email ?? "Company",
    company_user_id: companyUser.id,
    image_url: jobData.image_url ?? "",
    job_kind: jobData.job_kind ?? "employment",
    is_active: true,
    status: "active",
    open_positions: jobData.open_positions ?? 1,
  };

  // Only include age fields when they have a value so inserts work before
  // the 20260518 migration has been applied to the Supabase project.
  if (jobData.min_age != null) payload.min_age = jobData.min_age;
  if (jobData.max_age != null) payload.max_age = jobData.max_age;

  return insertJobRow(payload);
}

export async function updateJob(jobId: string, updates: UpdateJobInput): Promise<JobPost> {
  assertAllowedJobUpdateInput(toRecord(updates));

  const companyUser = await assertCompanyUser();
  const existing = await getJobById(jobId);

  if (!existing) {
    throw new Error("Job not found.");
  }

  if (existing.company_user_id !== companyUser.id) {
    throw new Error("You can only update your own jobs.");
  }

  const payload = buildJobUpdatePayload(updates);

  const hasExplicitCoordinates = updates.longitude !== undefined || updates.latitude !== undefined;
  if (hasExplicitCoordinates && !validCoordinates(updates.longitude, updates.latitude)) {
    throw new Error("Koordinater måste innehålla både giltig longitud och latitud.");
  }

  if (!hasExplicitCoordinates && (updates.address !== undefined || updates.postal_code !== undefined || updates.city !== undefined)) {
    const coordinates = await geocodeJobLocation({
      address: updates.address ?? existing.address,
      postalCode: updates.postal_code ?? existing.postal_code,
      city: updates.city ?? existing.city,
    });
    payload.longitude = coordinates?.longitude ?? null;
    payload.latitude = coordinates?.latitude ?? null;
  }

  if (!Object.keys(payload).length) {
    return existing;
  }

  return updateJobRow(jobId, payload);
}

export async function deleteJob(jobId: string): Promise<void> {
  const companyUser = await assertCompanyUser();
  const existing = await getJobById(jobId);

  if (!existing) {
    throw new Error("Job not found.");
  }

  if (existing.company_user_id !== companyUser.id) {
    throw new Error("You can only delete your own jobs.");
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.from("jobs").delete().eq("id", jobId);

  if (error) {
    logSupabaseError("jobs.delete", error, { jobId });
    throw new Error(getSupabaseErrorMessage(error, "Unable to delete job."));
  }
}

export async function getCompanyJobs(companyUserId?: string, includeInactive = true): Promise<JobPost[]> {
  const ownerId = companyUserId ?? (await assertCompanyUser()).id;
  const jobs = await getJobs(includeInactive);
  return jobs.filter((job) => job.company_user_id === ownerId);
}
