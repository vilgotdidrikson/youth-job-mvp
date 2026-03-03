import { NextRequest, NextResponse } from "next/server";
import { createId, readDb, updateDb } from "@/lib/db";
import { jsonError, requireUser } from "@/lib/api-auth";

interface ChatBody {
  message?: string;
}

async function readMatchId(context: {
  params: Promise<{ matchId: string }> | { matchId: string };
}): Promise<string> {
  const params = await context.params;
  return params.matchId;
}

export async function GET(
  request: NextRequest,
  context: {
    params: Promise<{ matchId: string }> | { matchId: string };
  },
): Promise<NextResponse> {
  const auth = await requireUser(request, ["youth", "company", "admin"]);
  if ("error" in auth) {
    return auth.error;
  }

  const matchId = await readMatchId(context);
  try {
    const db = await readDb();
    const result = (() => {
      const match = db.matches.find((entry) => entry.id === matchId);
      if (!match) {
        throw new Error("MATCH_NOT_FOUND");
      }
      if (
        auth.user.role !== "admin" &&
        auth.user.id !== match.youthId &&
        auth.user.id !== match.companyId
      ) {
        throw new Error("FORBIDDEN");
      }
      return db.matchMessages
        .filter((entry) => entry.matchId === matchId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    })();
    return NextResponse.json({ messages: result });
  } catch (error) {
    if (error instanceof Error && error.message === "MATCH_NOT_FOUND") {
      return jsonError("Match not found.", 404);
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return jsonError("Access denied.", 403);
    }
    return jsonError("Could not load chat.", 500);
  }
}

export async function POST(
  request: NextRequest,
  context: {
    params: Promise<{ matchId: string }> | { matchId: string };
  },
): Promise<NextResponse> {
  const auth = await requireUser(request, ["youth", "company"]);
  if ("error" in auth) {
    return auth.error;
  }

  const body = (await request.json().catch(() => ({}))) as ChatBody;
  const message = body.message?.trim() || "";
  if (!message) {
    return jsonError("Message is required.");
  }

  const matchId = await readMatchId(context);
  try {
    const result = await updateDb((db) => {
      const match = db.matches.find((entry) => entry.id === matchId);
      if (!match) {
        throw new Error("MATCH_NOT_FOUND");
      }
      if (auth.user.id !== match.youthId && auth.user.id !== match.companyId) {
        throw new Error("FORBIDDEN");
      }

      const createdAt = new Date().toISOString();
      const newMessage = {
        id: createId(),
        matchId,
        senderId: auth.user.id,
        message,
        createdAt,
      };
      db.matchMessages.push(newMessage);

      return newMessage;
    });

    return NextResponse.json({ message: result });
  } catch (error) {
    if (error instanceof Error && error.message === "MATCH_NOT_FOUND") {
      return jsonError("Match not found.", 404);
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return jsonError("Access denied.", 403);
    }
    return jsonError("Could not send message.", 500);
  }
}
