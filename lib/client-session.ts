"use client";

import { Role, SessionUser } from "@/lib/types";

const SESSION_KEY = "workspot_session";
export const SESSION_CHANGED_EVENT = "workspot_session_changed";
let cachedRaw: string | null | undefined;
let cachedSession: SessionUser | null = null;

export function saveSession(session: SessionUser): void {
  const raw = JSON.stringify(session);
  window.localStorage.setItem(SESSION_KEY, raw);
  cachedRaw = raw;
  cachedSession = session;
  window.dispatchEvent(new Event(SESSION_CHANGED_EVENT));
}

export function readSession(): SessionUser | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(SESSION_KEY);
  if (raw === cachedRaw) {
    return cachedSession;
  }

  cachedRaw = raw;
  if (!raw) {
    cachedSession = null;
    return null;
  }

  try {
    cachedSession = JSON.parse(raw) as SessionUser;
    return cachedSession;
  } catch {
    cachedSession = null;
    return null;
  }
}

export function clearSession(): void {
  window.localStorage.removeItem(SESSION_KEY);
  cachedRaw = null;
  cachedSession = null;
  window.dispatchEvent(new Event(SESSION_CHANGED_EVENT));
}

export function roleHome(role: Role): string {
  if (role === "youth") return "/youth";
  if (role === "company") return "/company";
  return "/admin";
}
