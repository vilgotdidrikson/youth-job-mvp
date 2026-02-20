import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { readDb } from "@/lib/db";

const FREE_POST_LIMIT = 3;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireUser(request, ["admin"]);
  if ("error" in auth) {
    return auth.error;
  }

  const db = await readDb();

  const companiesByTier = {
    free: db.companyProfiles.filter((profile) => profile.tier === "free").length,
    premium: db.companyProfiles.filter((profile) => profile.tier === "premium").length,
  };

  const freeTierLimitReached = db.companyProfiles.filter((profile) => {
    if (profile.tier !== "free") {
      return false;
    }
    const activeCount = db.jobs.filter(
      (job) => job.companyId === profile.userId && job.active,
    ).length;
    return activeCount >= FREE_POST_LIMIT;
  }).length;

  const recentUsers = [...db.users]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8)
    .map((user) => ({
      id: user.id,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    }));

  const recentJobs = [...db.jobs]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8)
    .map((job) => {
      const company = db.companyProfiles.find(
        (profile) => profile.userId === job.companyId,
      );
      return {
        id: job.id,
        title: job.title,
        jobType: job.jobType,
        location: job.location,
        companyName: company?.companyName || "Company",
        createdAt: job.createdAt,
      };
    });

  return NextResponse.json({
    stats: {
      users: db.users.length,
      youthProfiles: db.youthProfiles.length,
      companies: db.companyProfiles.length,
      jobs: db.jobs.length,
      activeJobs: db.jobs.filter((job) => job.active).length,
      interests: db.youthActions.filter((entry) => entry.action === "interested").length,
      matches: db.matches.length,
      unreadNotifications: db.notifications.filter((entry) => !entry.read).length,
    },
    monetization: {
      companiesByTier,
      freeTierLimitReached,
      freePostLimit: FREE_POST_LIMIT,
    },
    recentUsers,
    recentJobs,
  });
}
