import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireUser } from "@/lib/api-auth";
import { updateDb } from "@/lib/db";
import { CompanyProfile } from "@/lib/types";

interface CompanyProfileBody {
  companyName?: string;
  city?: string;
  description?: string;
  tier?: "free" | "premium";
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireUser(request, ["company"]);
  if ("error" in auth) {
    return auth.error;
  }

  const profile = await updateDb((db) => {
    let current = db.companyProfiles.find(
      (candidate) => candidate.userId === auth.user.id,
    );
    if (!current) {
      current = {
        userId: auth.user.id,
        companyName: "",
        city: "",
        description: "",
        tier: "free",
        updatedAt: new Date().toISOString(),
      } satisfies CompanyProfile;
      db.companyProfiles.push(current);
    }
    return current;
  });

  return NextResponse.json({ profile });
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const auth = await requireUser(request, ["company"]);
  if ("error" in auth) {
    return auth.error;
  }

  const body = (await request.json().catch(() => ({}))) as CompanyProfileBody;
  const profile = await updateDb((db) => {
    let current = db.companyProfiles.find(
      (candidate) => candidate.userId === auth.user.id,
    );
    if (!current) {
      current = {
        userId: auth.user.id,
        companyName: "",
        city: "",
        description: "",
        tier: "free",
        updatedAt: new Date().toISOString(),
      };
      db.companyProfiles.push(current);
    }

    current.companyName = body.companyName?.trim() ?? current.companyName;
    current.city = body.city?.trim() ?? current.city;
    current.description = body.description?.trim() ?? current.description;
    if (body.tier) {
      current.tier = body.tier;
    }
    current.updatedAt = new Date().toISOString();
    return current;
  });

  if (profile.tier !== "free" && profile.tier !== "premium") {
    return jsonError("Invalid tier.", 400);
  }

  return NextResponse.json({ profile });
}
