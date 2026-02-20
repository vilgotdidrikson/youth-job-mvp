import { NextRequest, NextResponse } from "next/server";
import { createId, updateDb } from "@/lib/db";
import { jsonError, requireUser } from "@/lib/api-auth";
import { YouthJobActionType } from "@/lib/types";

interface ActionBody {
  action?: YouthJobActionType;
}

async function readJobId(context: {
  params: Promise<{ jobId: string }> | { jobId: string };
}): Promise<string> {
  const params = await context.params;
  return params.jobId;
}

export async function POST(
  request: NextRequest,
  context: {
    params: Promise<{ jobId: string }> | { jobId: string };
  },
): Promise<NextResponse> {
  const auth = await requireUser(request, ["youth"]);
  if ("error" in auth) {
    return auth.error;
  }

  const body = (await request.json().catch(() => ({}))) as ActionBody;
  if (!body.action || !["interested", "skip"].includes(body.action)) {
    return jsonError("Action must be 'interested' or 'skip'.");
  }
  const action = body.action;

  const jobId = await readJobId(context);

  try {
    const result = await updateDb((db) => {
      const job = db.jobs.find((candidate) => candidate.id === jobId);
      if (!job || !job.active) {
        throw new Error("JOB_NOT_FOUND");
      }

      const existing = db.youthActions.find(
        (action) =>
          action.jobId === jobId && action.youthId === auth.user.id,
      );

      if (existing) {
        existing.action = action as YouthJobActionType;
        existing.createdAt = new Date().toISOString();
      } else {
        db.youthActions.push({
          id: createId(),
          youthId: auth.user.id,
          jobId,
          action,
          createdAt: new Date().toISOString(),
        });
      }

      if (action === "interested") {
        db.notifications.push({
          id: createId(),
          userId: job.companyId,
          type: "interest",
          message: `${auth.user.email} showed interest in "${job.title}".`,
          read: false,
          createdAt: new Date().toISOString(),
          metadata: `interest:${job.id}:${auth.user.id}`,
        });
      }

      return {
        action,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "JOB_NOT_FOUND") {
      return jsonError("Job not found.", 404);
    }
    return jsonError("Failed to update action.", 500);
  }
}
