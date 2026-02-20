import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireUser } from "@/lib/api-auth";
import { createId, readDb, updateDb } from "@/lib/db";
import { JobType } from "@/lib/types";

interface CreateJobBody {
  title?: string;
  description?: string;
  location?: string;
  jobType?: JobType;
}

const FREE_POST_LIMIT = 3;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireUser(request, ["company"]);
  if ("error" in auth) {
    return auth.error;
  }

  const db = await readDb();
  const jobs = db.jobs
    .filter((job) => job.companyId === auth.user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((job) => ({
      ...job,
      interestedCount: db.youthActions.filter(
        (action) => action.jobId === job.id && action.action === "interested",
      ).length,
    }));

  const companyProfile = db.companyProfiles.find(
    (profile) => profile.userId === auth.user.id,
  );

  return NextResponse.json({
    jobs,
    tier: companyProfile?.tier ?? "free",
    freePostLimit: FREE_POST_LIMIT,
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireUser(request, ["company"]);
  if ("error" in auth) {
    return auth.error;
  }

  const body = (await request.json().catch(() => ({}))) as CreateJobBody;
  if (!body.title?.trim() || !body.description?.trim() || !body.location?.trim()) {
    return jsonError("Title, description, and location are required.");
  }
  if (!body.jobType || !["part-time", "temporary", "summer"].includes(body.jobType)) {
    return jsonError("Job type must be part-time, temporary, or summer.");
  }

  try {
    const job = await updateDb((db) => {
      const profile = db.companyProfiles.find(
        (candidate) => candidate.userId === auth.user.id,
      );
      const activeJobs = db.jobs.filter(
        (candidate) => candidate.companyId === auth.user.id && candidate.active,
      );

      if (profile?.tier !== "premium" && activeJobs.length >= FREE_POST_LIMIT) {
        throw new Error("FREE_LIMIT_REACHED");
      }

      const nextJob = {
        id: createId(),
        companyId: auth.user.id,
        title: body.title!.trim(),
        description: body.description!.trim(),
        location: body.location!.trim(),
        jobType: body.jobType!,
        active: true,
        createdAt: new Date().toISOString(),
      };
      db.jobs.push(nextJob);
      return nextJob;
    });

    return NextResponse.json({ job });
  } catch (error) {
    if (error instanceof Error && error.message === "FREE_LIMIT_REACHED") {
      return jsonError(
        "Free tier limit reached. Upgrade to premium for more active listings.",
        403,
      );
    }
    return jsonError("Failed to create job.", 500);
  }
}
