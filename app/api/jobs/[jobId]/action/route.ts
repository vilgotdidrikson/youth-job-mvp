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
  const body = (await request.json().catch(() => ({}))) as ActionBody;
  const action = body.action;
  if (!action || !["interested", "skip"].includes(action)) {
    return jsonError("Action must be 'interested' or 'skip'.");
  }

  const auth = await requireUser(request, ["youth"]);
  if ("error" in auth) {
    return auth.error;
  }

  const jobId = await readJobId(context);

  try {
    const result = await updateDb((db) => {
      const job = db.jobs.find((entry) => entry.id === jobId);
      if (!job || !job.active) {
        throw new Error("JOB_NOT_FOUND");
      }

      const existing = db.youthActions.find(
        (entry) => entry.jobId === jobId && entry.youthId === auth.user.id,
      );

      if (existing) {
        existing.action = action;
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

      return { action };
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "JOB_NOT_FOUND") {
      return jsonError("Job not found.", 404);
    }
    return jsonError("Failed to update action.", 500);
  }
}
