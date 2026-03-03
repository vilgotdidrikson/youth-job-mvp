import { NextRequest, NextResponse } from "next/server";
import { jsonError, normalizeCsvInput, requireUser } from "@/lib/api-auth";
import { readDb, updateDb } from "@/lib/db";
import { profileStrength } from "@/lib/profile";
import { CVData, YouthProfile } from "@/lib/types";

interface YouthProfileBody {
  name?: string;
  age?: number | null;
  city?: string;
  contactEmail?: string;
  contactPhone?: string;
  targetRole?: string;
  skills?: string[] | string;
  interests?: string[] | string;
  experience?: string[] | string;
  availability?: string;
  premiumBadge?: boolean;
  cv?: CVData | null;
}

function normalizeList(
  value: string[] | string | undefined,
  fallback: string[],
): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => item.trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return normalizeCsvInput(value);
  }
  return fallback;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireUser(request, ["youth"]);
  if ("error" in auth) {
    return auth.error;
  }

  const db = await readDb();
  const result =
    db.youthProfiles.find((candidate) => candidate.userId === auth.user.id) ||
    ({
      userId: auth.user.id,
      name: "",
      age: null,
      city: "",
      contactEmail: auth.user.email,
      contactPhone: "",
      targetRole: "",
      skills: [],
      interests: [],
      experience: [],
      availability: "",
      premiumBadge: false,
      cv: null,
      updatedAt: new Date().toISOString(),
    } satisfies YouthProfile);

  return NextResponse.json({
    profile: result,
    profileStrength: profileStrength(result),
  });
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const auth = await requireUser(request, ["youth"]);
  if ("error" in auth) {
    return auth.error;
  }

  const body = (await request.json().catch(() => ({}))) as YouthProfileBody;
  if (
    typeof body.age === "number" &&
    Number.isFinite(body.age) &&
    (body.age < 12 || body.age > 20)
  ) {
    return jsonError("Age must be between 12 and 20 for youth users.");
  }

  const result = await updateDb((db) => {
    let profile = db.youthProfiles.find(
      (candidate) => candidate.userId === auth.user.id,
    );

    if (!profile) {
      profile = {
        userId: auth.user.id,
        name: "",
        age: null,
        city: "",
        contactEmail: auth.user.email,
        contactPhone: "",
        targetRole: "",
        skills: [],
        interests: [],
        experience: [],
        availability: "",
        premiumBadge: false,
        cv: null,
        updatedAt: new Date().toISOString(),
      } satisfies YouthProfile;
      db.youthProfiles.push(profile);
    }

    profile.name = body.name?.trim() ?? profile.name;
    profile.age =
      body.age === null
        ? null
        : typeof body.age === "number"
          ? body.age
          : profile.age;
    profile.city = body.city?.trim() ?? profile.city;
    profile.contactEmail =
      body.contactEmail?.trim().toLowerCase() ?? profile.contactEmail ?? auth.user.email;
    profile.contactPhone = body.contactPhone?.trim() ?? profile.contactPhone;
    profile.targetRole = body.targetRole?.trim() ?? profile.targetRole;
    profile.skills = normalizeList(body.skills, profile.skills);
    profile.interests = normalizeList(body.interests, profile.interests);
    profile.experience = normalizeList(body.experience, profile.experience);
    profile.availability = body.availability?.trim() ?? profile.availability;
    profile.premiumBadge = body.premiumBadge ?? profile.premiumBadge;
    profile.cv = body.cv === undefined ? profile.cv : body.cv;
    profile.updatedAt = new Date().toISOString();

    return profile;
  });

  return NextResponse.json({
    profile: result,
    profileStrength: profileStrength(result),
  });
}
