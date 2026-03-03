import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { readDb } from "@/lib/db";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireUser(request, ["youth"]);
  if ("error" in auth) {
    return auth.error;
  }
  const query = request.nextUrl.searchParams.get("q")?.trim().toLowerCase() || "";

  const db = await readDb();
  const actionMap = new Map(
    db.youthActions
      .filter((action) => action.youthId === auth.user.id)
      .map((action) => [action.jobId, action.action]),
  );

  const activeJobs = db.jobs.filter((job) => job.active);

  const jobs = activeJobs
    .filter((job) => {
      if (!query) return true;
      const company = db.companyProfiles.find(
        (candidate) => candidate.userId === job.companyId,
      );
      const haystack = `${job.title} ${job.description} ${job.location} ${company?.companyName || ""}`
        .toLowerCase()
        .trim();
      return haystack.includes(query);
    })
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
