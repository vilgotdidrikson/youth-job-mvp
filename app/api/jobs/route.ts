import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { readDb } from "@/lib/db";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireUser(request, ["youth"]);
  if ("error" in auth) {
    return auth.error;
  }

  const db = await readDb();
  const actionMap = new Map(
    db.youthActions
      .filter((action) => action.youthId === auth.user.id)
      .map((action) => [action.jobId, action.action]),
  );

  const jobs = db.jobs
    .filter((job) => job.active)
    .filter((job) => actionMap.get(job.id) !== "skip")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((job) => {
      const company = db.companyProfiles.find(
        (candidate) => candidate.userId === job.companyId,
      );
      return {
        ...job,
        companyName: company?.companyName || "Company",
        companyCity: company?.city || job.location,
        decision: actionMap.get(job.id) ?? null,
      };
    });

  return NextResponse.json({ jobs });
}
