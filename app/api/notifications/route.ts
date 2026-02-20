import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { updateDb } from "@/lib/db";

interface NotificationPatchBody {
  id?: string;
  markAllRead?: boolean;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireUser(request);
  if ("error" in auth) {
    return auth.error;
  }

  const result = await updateDb((db) => {
    return db.notifications
      .filter((entry) => entry.userId === auth.user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });

  return NextResponse.json({
    notifications: result,
    unreadCount: result.filter((entry) => !entry.read).length,
  });
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const auth = await requireUser(request);
  if ("error" in auth) {
    return auth.error;
  }

  const body = (await request.json().catch(() => ({}))) as NotificationPatchBody;
  const notifications = await updateDb((db) => {
    if (body.markAllRead) {
      db.notifications.forEach((entry) => {
        if (entry.userId === auth.user.id) {
          entry.read = true;
        }
      });
    } else if (body.id) {
      const current = db.notifications.find(
        (entry) => entry.id === body.id && entry.userId === auth.user.id,
      );
      if (current) {
        current.read = true;
      }
    }

    return db.notifications
      .filter((entry) => entry.userId === auth.user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });

  return NextResponse.json({
    notifications,
    unreadCount: notifications.filter((entry) => !entry.read).length,
  });
}
