"use client";

import { createClient, type Session, type User } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase";
import { getSupabaseErrorMessage, isNetworkError, NETWORK_ERROR_MESSAGE } from "@/lib/supabase-errors";
import type { Profile, Role } from "@/lib/types";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// 4xx answers (account already exists, wrong password, ...) are expected user
// input errors that the form explains, and a lost connection is not a bug;
// only log real failures as errors.
function logUnexpectedAuthError(message: string, error: { status?: number }) {
  if (error.status && error.status >= 400 && error.status < 500) return;
  if (isNetworkError(error)) {
    console.warn(message, error);
    return;
  }
  console.error(message, error);
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
    options: {
      // The auth.users trigger validates this allowlisted value and creates the
      // immutable application profile in the same database transaction.
      data: { role },
    },
  });

  if (error) {
    logUnexpectedAuthError("Supabase sign up failed.", error);
    throw new Error(getSupabaseErrorMessage(error, error.message));
  }

  if (!data.user?.id) {
    const unexpectedError = new Error("Supabase did not return a user during sign up.");
    console.error(unexpectedError.message);
    throw unexpectedError;
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
    logUnexpectedAuthError("Supabase sign in failed.", error);
    throw new Error(getSupabaseErrorMessage(error, error.message));
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
  if (error) throw new Error(error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit"
    ? "För många försök. Vänta en stund och begär sedan en ny länk."
    : getSupabaseErrorMessage(error, "Kunde inte skicka återställningslänken."));
}

export async function updatePassword(password: string): Promise<void> {
  if (password.length < 8) throw new Error("Lösenordet måste innehålla minst 8 tecken.");
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

  // Reauthentication must not sign a different account into the shared client
  // if the user switches account while this request is in flight.
  const reauth = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: `mnw-password-check-${crypto.randomUUID()}` },
  });
  const { data: verified, error: passwordError } = await reauth.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (passwordError || verified.user?.id !== user.id) throw new Error("Ditt nuvarande lösenord stämmer inte.");

  const { error } = await reauth.auth.updateUser({ password: newPassword });
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
    // Without a server answer the stored session may still be valid; keep it
    // so the user is not signed out by a dropped connection.
    if (isNetworkError(error) || (error.status ?? 0) >= 500) throw new Error(NETWORK_ERROR_MESSAGE);
    // Clear the caller's UI through SessionProvider. Signing out the shared
    // client here could clear a newer account after this request's auth lock
    // has been released. The SDK owns refresh-token/storage cleanup.
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
    if (isNetworkError(error)) throw new Error(NETWORK_ERROR_MESSAGE);
    console.error("Failed to load the current user's profile row.", error);
    throw new Error(error.message);
  }

  return data ?? null;
}
