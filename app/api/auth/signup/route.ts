import { NextRequest, NextResponse } from "next/server";
import {
  companyNeedsOnboarding,
  jsonError,
  toPublicUser,
  youthNeedsOnboarding,
} from "@/lib/api-auth";
import { createId, updateDb } from "@/lib/db";
import { CompanyProfile, Role, User, YouthProfile } from "@/lib/types";

interface SignUpBody {
  email?: string;
  password?: string;
  role?: Role;
  phone?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json().catch(() => ({}))) as SignUpBody;
  const email = body.email?.trim().toLowerCase();
  const password = body.password?.trim();
  const role = body.role;
  const phone = body.phone?.trim() || "";

  if (!email || !password || !role) {
    return jsonError("Email, password, and role are required.");
  }
  if (!["youth", "company"].includes(role)) {
    return jsonError("Unsupported role.");
  }
  if (password.length < 6) {
    return jsonError("Password must be at least 6 characters.");
  }

  try {
    const result = await updateDb((db) => {
      if (db.users.some((candidate) => candidate.email === email)) {
        throw new Error("EMAIL_EXISTS");
      }

      const user: User = {
        id: createId(),
        email,
        password,
        role,
        createdAt: new Date().toISOString(),
      };
      db.users.push(user);

      let needsOnboarding = false;

      if (role === "youth") {
        const profile: YouthProfile = {
          userId: user.id,
          name: "",
          age: null,
          city: "",
          contactEmail: email,
          contactPhone: phone,
          targetRole: "",
          skills: [],
          interests: [],
          experience: [],
          availability: "",
          premiumBadge: false,
          cv: null,
          updatedAt: new Date().toISOString(),
        };
        db.youthProfiles.push(profile);
        needsOnboarding = youthNeedsOnboarding(profile);
      } else {
        const profile: CompanyProfile = {
          userId: user.id,
          companyName: "",
          city: "",
          description: "",
          tier: "free",
          updatedAt: new Date().toISOString(),
        };
        db.companyProfiles.push(profile);
        needsOnboarding = companyNeedsOnboarding(profile);
      }

      return {
        user,
        needsOnboarding,
      };
    });

    return NextResponse.json({
      user: toPublicUser(result.user),
      needsOnboarding: result.needsOnboarding,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "EMAIL_EXISTS") {
      return jsonError("An account with this email already exists.", 409);
    }
    return jsonError("Failed to create account.", 500);
  }
}
