import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { Database, JobListing, User, YouthProfile, CompanyProfile } from "@/lib/types";

const DB_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DB_DIR, "db.json");
const now = "2026-02-20T12:00:00.000Z";

const seededUsers: User[] = [
  {
    id: "admin-1",
    email: "admin@workspot.se",
    password: "admin123",
    role: "admin",
    createdAt: now,
  },
  {
    id: "youth-demo",
    email: "demo@youth.se",
    password: "demo123",
    role: "youth",
    createdAt: now,
  },
  {
    id: "company-demo",
    email: "demo@company.se",
    password: "demo123",
    role: "company",
    createdAt: now,
  },
  {
    id: "company-cafe",
    email: "jobs@fikaexpress.se",
    password: "demo123",
    role: "company",
    createdAt: now,
  },
  {
    id: "company-events",
    email: "team@eventjunior.se",
    password: "demo123",
    role: "company",
    createdAt: now,
  },
  {
    id: "company-logistics",
    email: "hello@packsnabb.se",
    password: "demo123",
    role: "company",
    createdAt: now,
  },
  {
    id: "company-kids",
    email: "work@barnfokus.se",
    password: "demo123",
    role: "company",
    createdAt: now,
  },
  {
    id: "company-tech",
    email: "apply@codecampyouth.se",
    password: "demo123",
    role: "company",
    createdAt: now,
  },
];

const seededYouthProfiles: YouthProfile[] = [
  {
    userId: "youth-demo",
    name: "Maja Nilsson",
    age: 17,
    city: "Stockholm",
    targetRole: "Cafe barista",
    skills: ["Customer service", "Social media", "Teamwork"],
    interests: ["Retail", "Cafe work", "Events"],
    experience: [
      "Volunteered at school event check-in desk",
      "Helped in local cafe during weekend rush",
    ],
    availability: "Weekdays after school + weekends",
    premiumBadge: false,
    cv: {
      summary:
        "Service-minded student in Stockholm looking for part-time and summer opportunities.",
      content:
        "Maja Nilsson\nStockholm, Sweden\n\nSummary\nService-minded high school student with school event volunteering and strong teamwork skills.\n\nSkills\n- Customer service\n- Social media\n- Teamwork\n\nInterests\nRetail, cafe work, events.\n\nExperience\n- Volunteered at school event check-in desk.\n- Helped in local cafe during weekend rush.\n\nAvailability\nWeekdays after school and weekends.",
      qualityScore: 80,
      updatedAt: now,
    },
    updatedAt: now,
  },
];

const seededCompanyProfiles: CompanyProfile[] = [
  {
    userId: "company-demo",
    companyName: "Nordic Youth Retail",
    city: "Stockholm",
    description: "Retail chain hiring youth for flexible shifts.",
    tier: "free",
    updatedAt: now,
  },
  {
    userId: "company-cafe",
    companyName: "Fika Express",
    city: "Stockholm",
    description: "Cafe group with evening and weekend shifts.",
    tier: "premium",
    updatedAt: now,
  },
  {
    userId: "company-events",
    companyName: "Event Junior",
    city: "Göteborg",
    description: "Temporary event and festival staffing for youth.",
    tier: "free",
    updatedAt: now,
  },
  {
    userId: "company-logistics",
    companyName: "PackSnabb",
    city: "Malmö",
    description: "Warehouse and e-commerce support for seasonal peaks.",
    tier: "free",
    updatedAt: now,
  },
  {
    userId: "company-kids",
    companyName: "BarnFokus",
    city: "Uppsala",
    description: "After-school and family support programs.",
    tier: "free",
    updatedAt: now,
  },
  {
    userId: "company-tech",
    companyName: "CodeCamp Youth",
    city: "Stockholm",
    description: "Tech workshops and junior helper roles.",
    tier: "premium",
    updatedAt: now,
  },
];

const seededJobs: JobListing[] = [
  {
    id: "job-demo-1",
    companyId: "company-demo",
    title: "Summer Store Assistant",
    description: "Help customers, restock shelves, and support checkout flow.",
    location: "Stockholm",
    jobType: "summer",
    active: true,
    createdAt: now,
  },
  {
    id: "job-demo-2",
    companyId: "company-demo",
    title: "Weekend Cashier Helper",
    description: "Support senior cashier and greet customers during peak hours.",
    location: "Stockholm",
    jobType: "part-time",
    active: true,
    createdAt: now,
  },
  {
    id: "job-cafe-1",
    companyId: "company-cafe",
    title: "Junior Barista",
    description: "Prepare drinks, handle counter orders, and keep cafe area clean.",
    location: "Stockholm",
    jobType: "part-time",
    active: true,
    createdAt: now,
  },
  {
    id: "job-cafe-2",
    companyId: "company-cafe",
    title: "Cafe Summer Staff",
    description: "Support kitchen prep, customer service, and table service.",
    location: "Stockholm",
    jobType: "summer",
    active: true,
    createdAt: now,
  },
  {
    id: "job-events-1",
    companyId: "company-events",
    title: "Festival Crew Assistant",
    description: "Help with visitor guidance, wristband checks, and queue flow.",
    location: "Göteborg",
    jobType: "temporary",
    active: true,
    createdAt: now,
  },
  {
    id: "job-events-2",
    companyId: "company-events",
    title: "Event Setup Helper",
    description: "Assist in setup and teardown for youth sports events.",
    location: "Göteborg",
    jobType: "temporary",
    active: true,
    createdAt: now,
  },
  {
    id: "job-log-1",
    companyId: "company-logistics",
    title: "Package Sorting Assistant",
    description: "Sort and label parcels with team leads in evening shifts.",
    location: "Malmö",
    jobType: "part-time",
    active: true,
    createdAt: now,
  },
  {
    id: "job-log-2",
    companyId: "company-logistics",
    title: "Summer Warehouse Helper",
    description: "Support inbound and outbound package handling.",
    location: "Malmö",
    jobType: "summer",
    active: true,
    createdAt: now,
  },
  {
    id: "job-kids-1",
    companyId: "company-kids",
    title: "After-School Activity Helper",
    description: "Support group activities and check-in for younger students.",
    location: "Uppsala",
    jobType: "part-time",
    active: true,
    createdAt: now,
  },
  {
    id: "job-kids-2",
    companyId: "company-kids",
    title: "Weekend Babysitting Support",
    description: "Assist families with playful, safe childcare sessions.",
    location: "Uppsala",
    jobType: "temporary",
    active: true,
    createdAt: now,
  },
  {
    id: "job-tech-1",
    companyId: "company-tech",
    title: "Coding Workshop Helper",
    description: "Help younger students during beginner coding sessions.",
    location: "Stockholm",
    jobType: "temporary",
    active: true,
    createdAt: now,
  },
  {
    id: "job-tech-2",
    companyId: "company-tech",
    title: "Content Assistant (Tech)",
    description: "Create short social posts and event photos for workshop days.",
    location: "Stockholm",
    jobType: "part-time",
    active: true,
    createdAt: now,
  },
];

const seedDatabase: Database = {
  users: [...seededUsers],
  youthProfiles: [...seededYouthProfiles],
  companyProfiles: [...seededCompanyProfiles],
  jobs: [...seededJobs],
  youthActions: [],
  companyDecisions: [],
  matches: [],
  notifications: [],
};

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function cloneYouthProfile(profile: YouthProfile): YouthProfile {
  return {
    ...profile,
    skills: [...profile.skills],
    interests: [...profile.interests],
    experience: [...profile.experience],
    cv: profile.cv ? { ...profile.cv } : null,
  };
}

function mergeSeedData(db: Database): { changed: boolean; nextDb: Database } {
  const nextDb: Database = {
    users: [...(db.users || [])],
    youthProfiles: [...(db.youthProfiles || [])].map((profile) => ({
      ...profile,
      targetRole: profile.targetRole || "",
      experience: Array.isArray(profile.experience) ? profile.experience : [],
      skills: Array.isArray(profile.skills) ? profile.skills : [],
      interests: Array.isArray(profile.interests) ? profile.interests : [],
    })),
    companyProfiles: [...(db.companyProfiles || [])],
    jobs: [...(db.jobs || [])],
    youthActions: [...(db.youthActions || [])],
    companyDecisions: [...(db.companyDecisions || [])],
    matches: [...(db.matches || [])],
    notifications: [...(db.notifications || [])],
  };
  let changed = false;

  seededUsers.forEach((user) => {
    if (!nextDb.users.some((entry) => entry.id === user.id)) {
      nextDb.users.push({ ...user });
      changed = true;
    }
  });

  seededYouthProfiles.forEach((profile) => {
    if (!nextDb.youthProfiles.some((entry) => entry.userId === profile.userId)) {
      nextDb.youthProfiles.push(cloneYouthProfile(profile));
      changed = true;
    }
  });

  seededCompanyProfiles.forEach((profile) => {
    if (!nextDb.companyProfiles.some((entry) => entry.userId === profile.userId)) {
      nextDb.companyProfiles.push({ ...profile });
      changed = true;
    }
  });

  seededJobs.forEach((job) => {
    if (!nextDb.jobs.some((entry) => entry.id === job.id)) {
      nextDb.jobs.push({ ...job });
      changed = true;
    }
  });

  return { changed, nextDb };
}

async function ensureDbFile(): Promise<void> {
  await fs.mkdir(DB_DIR, { recursive: true });
  const exists = await fileExists(DB_FILE);
  if (!exists) {
    await fs.writeFile(DB_FILE, JSON.stringify(seedDatabase, null, 2), "utf8");
  }
}

async function writeDb(db: Database): Promise<void> {
  await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2), "utf8");
}

export async function readDb(): Promise<Database> {
  await ensureDbFile();
  try {
    const raw = await fs.readFile(DB_FILE, "utf8");
    const parsed = JSON.parse(raw) as Database;
    const merged = mergeSeedData(parsed);
    if (merged.changed) {
      await writeDb(merged.nextDb);
    }
    return merged.nextDb;
  } catch {
    await writeDb(seedDatabase);
    return seedDatabase;
  }
}

export async function updateDb<T>(mutate: (db: Database) => T): Promise<T> {
  const db = await readDb();
  const result = mutate(db);
  await writeDb(db);
  return result;
}

export function createId(): string {
  return randomUUID();
}
