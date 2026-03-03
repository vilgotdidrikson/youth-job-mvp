"use client";

import { readSession } from "@/lib/client-session";

interface ApiRequestOptions extends RequestInit {
  userId?: string;
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  const fallbackSession = readSession();
  const sessionUserId = options.userId || fallbackSession?.id;
  const isApiPath = path.startsWith("/api/");
  const isAuthPath = path.startsWith("/api/auth/");
  if (isApiPath && !isAuthPath && !sessionUserId) {
    throw new ApiError("Unauthorized.", 401);
  }
  if (sessionUserId) {
    headers.set("x-user-id", sessionUserId);
  }
  if (fallbackSession?.email) {
    headers.set("x-user-email", fallbackSession.email);
  }

  const response = await fetch(path, {
    ...options,
    headers,
  });

  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
  };

  if (!response.ok) {
    const message = payload.error || "Request failed.";
    throw new ApiError(message, response.status);
  }

  return payload as T;
}
