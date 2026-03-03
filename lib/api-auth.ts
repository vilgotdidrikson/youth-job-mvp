import { NextRequest, NextResponse } from "next/server";
import { readDb } from "@/lib/db";
import {
  PublicUser,
  Role,
  User,
  YouthProfile,
  CompanyProfile,
} from "@/lib/types";

export function jsonError(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
  };
}

export function youthNeedsOnboarding(profile: YouthProfile | undefined): boolean {
  if (!profile) {
    return true;
  }
  return !(
    profile.name.trim() &&
    profile.age &&
    profile.city.trim() &&
    profile.targetRole.trim() &&
    profile.skills.length > 0 &&
    profile.availability.trim()
  );
}

export function companyNeedsOnboarding(
  profile: CompanyProfile | undefined,
): boolean {
  if (!profile) {
    return true;
  }
  return !(profile.companyName.trim() && profile.city.trim());
}

export async function requireUser(
  request: NextRequest,
  roles?: Role[],
): Promise<
  | {
      user: User;
    }
  | {
      error: NextResponse;
    }
> {
  const userId = request.headers.get("x-user-id");
  const userEmail = request.headers.get("x-user-email")?.toLowerCase().trim();
  if (!userId && !userEmail) {
    return { error: jsonError("Unauthorized.", 401) };
  }

  const db = await readDb();
  const userById = userId
    ? db.users.find((candidate) => candidate.id === userId)
    : undefined;
  const userByEmail = userEmail
    ? db.users.find((candidate) => candidate.email === userEmail)
    : undefined;
  const user = userById || userByEmail;
  if (!user) {
    return { error: jsonError("Unauthorized.", 401) };
  }

  if (roles && !roles.includes(user.role)) {
    return { error: jsonError("Access denied.", 403) };
  }

  return { user };
}

export function normalizeCsvInput(raw: string): string[] {
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
