import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { readDb } from "@/lib/db";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireUser(request, ["youth", "company", "admin"]);
  if ("error" in auth) {
    return auth.error;
  }

  const db = await readDb();
  const scopedMatches = db.matches
    .filter((match) => {
      if (auth.user.role === "youth") return match.youthId === auth.user.id;
      if (auth.user.role === "company") return match.companyId === auth.user.id;
      return true;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((match) => {
      const job = db.jobs.find((candidate) => candidate.id === match.jobId);
      const youthProfile = db.youthProfiles.find(
        (candidate) => candidate.userId === match.youthId,
      );
      const companyProfile = db.companyProfiles.find(
        (candidate) => candidate.userId === match.companyId,
      );
      const youthUser = db.users.find((candidate) => candidate.id === match.youthId);
      const companyUser = db.users.find(
        (candidate) => candidate.id === match.companyId,
      );

      return {
        id: match.id,
        jobId: match.jobId,
        jobTitle: job?.title || "Job",
        location: job?.location || "Sweden",
        jobType: job?.jobType || "temporary",
        companyName: companyProfile?.companyName || companyUser?.email || "Company",
        candidateName: youthProfile?.name || youthUser?.email || "Candidate",
        candidateCity: youthProfile?.city || "Sweden",
        candidateAvailability: youthProfile?.availability || "",
        candidateSkills: youthProfile?.skills || [],
        candidateCvSummary: youthProfile?.cv?.summary || "",
        youthId: match.youthId,
        companyId: match.companyId,
        companyUserEmail: companyUser?.email || "",
        candidateUserEmail: youthUser?.email || "",
        createdAt: match.createdAt,
      };
    });

  return NextResponse.json({ matches: scopedMatches });
}
