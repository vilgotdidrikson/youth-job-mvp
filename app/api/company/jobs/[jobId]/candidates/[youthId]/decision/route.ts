import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireUser } from "@/lib/api-auth";
import { createId, updateDb } from "@/lib/db";
import { CompanyDecisionState } from "@/lib/types";

interface DecisionBody {
  decision?: CompanyDecisionState;
}

async function readParams(context: {
  params:
    | Promise<{
        jobId: string;
        youthId: string;
      }>
    | {
        jobId: string;
        youthId: string;
      };
}): Promise<{ jobId: string; youthId: string }> {
  return await context.params;
}

export async function POST(
  request: NextRequest,
  context: {
    params:
      | Promise<{
          jobId: string;
          youthId: string;
        }>
      | {
          jobId: string;
          youthId: string;
        };
  },
): Promise<NextResponse> {
  const auth = await requireUser(request, ["company"]);
  if ("error" in auth) {
    return auth.error;
  }

  const body = (await request.json().catch(() => ({}))) as DecisionBody;
  if (!body.decision || !["accept", "reject"].includes(body.decision)) {
    return jsonError("Decision must be 'accept' or 'reject'.");
  }

  const { jobId, youthId } = await readParams(context);

  try {
    const result = await updateDb((db) => {
      const job = db.jobs.find((candidate) => candidate.id === jobId);
      if (!job || job.companyId !== auth.user.id) {
        throw new Error("JOB_NOT_FOUND");
      }

      const interest = db.youthActions.find(
        (action) =>
          action.jobId === jobId &&
          action.youthId === youthId &&
          action.action === "interested",
      );
      if (!interest) {
        throw new Error("NO_INTEREST");
      }

      const now = new Date().toISOString();
      const existingDecision = db.companyDecisions.find(
        (entry) =>
          entry.companyId === auth.user.id &&
          entry.jobId === jobId &&
          entry.youthId === youthId,
      );

      if (existingDecision) {
        existingDecision.decision = body.decision as CompanyDecisionState;
        existingDecision.createdAt = now;
      } else {
        db.companyDecisions.push({
          id: createId(),
          companyId: auth.user.id,
          youthId,
          jobId,
          decision: body.decision as CompanyDecisionState,
          createdAt: now,
        });
      }

      let matched = false;
      if (body.decision === "accept") {
        const existingMatch = db.matches.find(
          (entry) =>
            entry.companyId === auth.user.id &&
            entry.jobId === jobId &&
            entry.youthId === youthId,
        );
        if (!existingMatch) {
          db.matches.push({
            id: createId(),
            companyId: auth.user.id,
            youthId,
            jobId,
            createdAt: now,
          });
          matched = true;
        }
      }

      return {
        decision: body.decision,
        matched,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "JOB_NOT_FOUND") {
      return jsonError("Job not found.", 404);
    }
    if (error instanceof Error && error.message === "NO_INTEREST") {
      return jsonError("Candidate has not marked interest for this job.", 400);
    }
    return jsonError("Could not update candidate decision.", 500);
  }
}
