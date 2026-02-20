import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireUser } from "@/lib/api-auth";
import { readDb } from "@/lib/db";
import { CvChatMessage, generateCvChatReply } from "@/lib/cv-ai";

interface CvChatBody {
  messages?: CvChatMessage[];
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireUser(request, ["youth"]);
  if ("error" in auth) {
    return auth.error;
  }

  const body = (await request.json().catch(() => ({}))) as CvChatBody;
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return jsonError("Chat messages are required.");
  }

  const db = await readDb();
  const profile = db.youthProfiles.find((candidate) => candidate.userId === auth.user.id);
  if (!profile) {
    return jsonError("Create your profile before using CV chat.", 404);
  }

  const result = generateCvChatReply({
    profile,
    messages: body.messages,
  });

  return NextResponse.json(result);
}
