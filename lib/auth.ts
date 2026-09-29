"use client";

import type { Session, User } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase";
import type { Profile, Role } from "@/lib/types";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function insertRoleProfile(userId: string, role: Role) {
  const supabase = getSupabaseClient();
  const { error } = role === "youth"
    ? await supabase.from("youth_profiles").insert({ user_id: userId })
    : role === "company"
      ? await supabase.from("company_profiles").insert({ user_id: userId })
      : await supabase.from("private_profiles").insert({ user_id: userId });
  if (error) throw new Error(error.message);
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

  const { error: profileError } = await supabase.from("profiles").insert({ id: data.user.id, role });
  if (profileError) throw new Error(profileError.message);
  try {
    await insertRoleProfile(data.user.id, role);
  } catch (profileInsertError) {
    await supabase.from("profiles").delete().eq("id", data.user.id);
    throw profileInsertError;
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

export async function requestPasswordReset(email: string): Promise<void> {
  const supabase = getSupabaseClient();
  const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/reset-password` : undefined;
  const { error } = await supabase.auth.resetPasswordForEmail(normalizeEmail(email), { redirectTo });
  if (error) throw new Error(error.message);
}

export async function updatePassword(password: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(error.message);
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  if (newPassword.length < 8) throw new Error("Det nya lösenordet måste innehålla minst 8 tecken.");

  const supabase = getSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData.user;
  if (userError || !user?.email) throw new Error("Din session är inte giltig. Logga in igen.");

  const { data: verified, error: passwordError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (passwordError || verified.user?.id !== user.id) throw new Error("Ditt nuvarande lösenord stämmer inte.");

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
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
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    // A browser may retain a stale local session after a token was revoked.
    // Treat it as signed out so UI state agrees with protected API routes.
    await supabase.auth.signOut({ scope: "local" });
    return null;
  }

  return user ?? null;
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
