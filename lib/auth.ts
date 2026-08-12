"use client";

import type { Session, User } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase";
import type { Profile, Role } from "@/lib/types";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function rollbackProfileInsert(userId: string) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("profiles").delete().eq("id", userId);

  if (error) {
    console.error("Failed to roll back profiles insert after signup error.", error);
  }
}

async function insertRoleProfile(userId: string, role: Role) {
  const supabase = getSupabaseClient();
  const { error } =
    role === "youth"
      ? await supabase.from("youth_profiles").insert({ user_id: userId })
      : role === "company"
        ? await supabase.from("company_profiles").insert({ user_id: userId })
        : await supabase.from("private_profiles").insert({ user_id: userId });

  if (error) {
    console.error(`Failed to insert ${role}_profiles row during signup.`, error);
    throw new Error(error.message);
  }
}

export async function signUp(
  email: string,
  password: string,
  role: Role,
): Promise<{ user: User; session: Session | null }> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signUp({
    email: normalizeEmail(email),
    password,
  });

  if (error) {
    console.error("Supabase sign up failed.", error);
    throw new Error(error.message);
  }

  if (!data.user?.id) {
    const unexpectedError = new Error("Supabase did not return a user during sign up.");
    console.error(unexpectedError.message);
    throw unexpectedError;
  }

  const { error: profileError } = await supabase.from("profiles").insert({
    id: data.user.id,
    role,
  });

  if (profileError) {
    console.error("Failed to insert profiles row during signup.", profileError);
    throw new Error(profileError.message);
  }

  try {
    await insertRoleProfile(data.user.id, role);
  } catch (error) {
    await rollbackProfileInsert(data.user.id);
    throw error;
  }

  return { user: data.user, session: data.session };
}

export async function signIn(email: string, password: string): Promise<Session> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizeEmail(email),
    password,
  });

  if (error) {
    console.error("Supabase sign in failed.", error);
    throw new Error(error.message);
  }

  if (!data.session) {
    const unexpectedError = new Error("Supabase did not return a session during sign in.");
    console.error(unexpectedError.message);
    throw unexpectedError;
  }

  return data.session;
}

export async function signOut(): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("Supabase sign out failed.", error);
    throw new Error(error.message);
  }
}

export async function getCurrentUser(): Promise<User | null> {
  const supabase = getSupabaseClient();
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    console.error("Failed to load the current Supabase session.", error);
    throw new Error(error.message);
  }

  return session?.user ?? null;
}

export async function getUserProfile(userId?: string): Promise<Profile | null> {
  const targetUserId = userId ?? (await getCurrentUser())?.id;

  if (!targetUserId) {
    return null;
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", targetUserId)
    .maybeSingle();

  if (error) {
    console.error("Failed to load the current user's profile row.", error);
    throw new Error(error.message);
  }

  return data ?? null;
}
