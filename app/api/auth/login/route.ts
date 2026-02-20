import { NextRequest, NextResponse } from "next/server";
import {
  companyNeedsOnboarding,
  jsonError,
  toPublicUser,
  youthNeedsOnboarding,
} from "@/lib/api-auth";
import { readDb } from "@/lib/db";

interface LoginBody {
  email?: string;
  password?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json().catch(() => ({}))) as LoginBody;
  const email = body.email?.trim().toLowerCase();
  const password = body.password?.trim();

  if (!email || !password) {
    return jsonError("Email and password are required.");
  }

  const db = await readDb();
  const user = db.users.find(
    (candidate) => candidate.email === email && candidate.password === password,
  );

  if (!user) {
    return jsonError("Invalid email or password.", 401);
  }

  let needsOnboarding = false;
  if (user.role === "youth") {
    const profile = db.youthProfiles.find(
      (candidate) => candidate.userId === user.id,
    );
    needsOnboarding = youthNeedsOnboarding(profile);
  } else if (user.role === "company") {
    const profile = db.companyProfiles.find(
      (candidate) => candidate.userId === user.id,
    );
    needsOnboarding = companyNeedsOnboarding(profile);
  }

  return NextResponse.json({
    user: toPublicUser(user),
    needsOnboarding,
  });
}
