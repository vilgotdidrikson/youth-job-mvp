import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireUser } from "@/lib/api-auth";
import { createId, updateDb } from "@/lib/db";

async function readJobId(context: {
  params: Promise<{ jobId: string }> | { jobId: string };
}): Promise<string> {
  const params = await context.params;
  return params.jobId;
}

export async function GET(
  request: NextRequest,
  context: {
    params: Promise<{ jobId: string }> | { jobId: string };
  },
): Promise<NextResponse> {
  const auth = await requireUser(request, ["company"]);
  if ("error" in auth) {
    return auth.error;
  }

  const jobId = await readJobId(context);

  try {
    const result = await updateDb((db) => {
      const job = db.jobs.find((candidate) => candidate.id === jobId);
      if (!job || job.companyId !== auth.user.id) {
        throw new Error("JOB_NOT_FOUND");
      }

      const companyProfile = db.companyProfiles.find(
        (candidate) => candidate.userId === auth.user.id,
      );
      const companyName = companyProfile?.companyName || auth.user.email;

      const interestedActions = db.youthActions.filter(
        (action) => action.jobId === jobId && action.action === "interested",
      );
      const decisions = db.companyDecisions.filter(
        (decision) => decision.jobId === jobId && decision.companyId === auth.user.id,
      );

      const candidates = interestedActions.map((action) => {
        const profile = db.youthProfiles.find(
          (candidate) => candidate.userId === action.youthId,
        );
        const user = db.users.find((candidate) => candidate.id === action.youthId);
        const decision = decisions.find(
          (entry) => entry.youthId === action.youthId,
        );

        const metadataKey = `profile_view:${jobId}:${auth.user.id}:${action.youthId}`;
        const alreadyNotified = db.notifications.some(
          (entry) => entry.metadata === metadataKey,
        );
        if (!alreadyNotified) {
          db.notifications.push({
            id: createId(),
            userId: action.youthId,
            type: "profile_view",
            message: `${companyName} viewed your profile for "${job.title}".`,
            read: false,
            metadata: metadataKey,
            createdAt: new Date().toISOString(),
          });
        }

        return {
          youthId: action.youthId,
          name: profile?.name || "Unnamed candidate",
          age: profile?.age ?? null,
          city: profile?.city || "Sweden",
          skills: profile?.skills || [],
          interests: profile?.interests || [],
          availability: profile?.availability || "",
          premiumBadge: profile?.premiumBadge ?? false,
          cvSummary: profile?.cv?.summary || "",
          cvContent: profile?.cv?.content || "",
          email: user?.email || "",
          interestedAt: action.createdAt,
          decision: decision?.decision || null,
        };
      });

      return {
        jobTitle: job.title,
        candidates: candidates.sort((a, b) =>
          b.interestedAt.localeCompare(a.interestedAt),
        ),
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "JOB_NOT_FOUND") {
      return jsonError("Job not found.", 404);
    }
    return jsonError("Failed to fetch candidates.", 500);
  }
}
