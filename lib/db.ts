import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  CompanyProfile,
  Database,
  JobListing,
  MatchMessage,
  MatchRecord,
  User,
  YouthProfile,
} from "@/lib/types";

const DB_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DB_DIR, "db.json");
const now = "2026-03-03T12:00:00.000Z";

const seededUsers: User[] = [
  {
    id: "admin-1",
    email: "admin@workspot.se",
    password: "admin123",
    role: "admin",
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
    id: "youth-demo",
    email: "demo@youth.se",
    password: "demo123",
    role: "youth",
    createdAt: now,
  },
];

const seededYouthProfiles: YouthProfile[] = [
  {
    userId: "youth-demo",
    name: "Maja Nilsson",
    age: 17,
    city: "Stockholm",
    contactEmail: "demo@youth.se",
    contactPhone: "+46 70 123 45 67",
    targetRole: "Cafébiträde",
    skills: ["Kundservice", "Samarbete"],
    interests: ["Sport", "Musik"],
    experience: ["Hjälpte till vid skolevenemang med incheckning"],
    availability: "Vardagar efter skolan",
    premiumBadge: false,
    cv: null,
    updatedAt: now,
  },
];

const seededCompanyProfiles: CompanyProfile[] = [
  {
    userId: "company-cafe",
    companyName: "Fika Express",
    city: "Stockholm",
    description: "Café som söker ungdomar för deltid och helgpass.",
    tier: "premium",
    updatedAt: now,
  },
  {
    userId: "company-events",
    companyName: "Event Junior",
    city: "Göteborg",
    description: "Eventbemanning för ungdomar.",
    tier: "free",
    updatedAt: now,
  },
  {
    userId: "company-logistics",
    companyName: "PackSnabb",
    city: "Malmö",
    description: "Lager- och pakethantering för extra personal.",
    tier: "free",
    updatedAt: now,
  },
];

const seededJobs: JobListing[] = [
  {
    id: "job-cafe-1",
    companyId: "company-cafe",
    title: "Cafébiträde",
    description: "Ta beställningar, servera och hjälpa kunder i caféet.",
    location: "Stockholm",
    jobType: "part-time",
    active: true,
    createdAt: now,
  },
  {
    id: "job-cafe-2",
    companyId: "company-cafe",
    title: "Barista (helg)",
    description: "Förbereda kaffe och hjälpa till i kassan under helger.",
    location: "Stockholm",
    jobType: "part-time",
    active: true,
    createdAt: now,
  },
  {
    id: "job-events-1",
    companyId: "company-events",
    title: "Eventmedarbetare",
    description: "Hjälpa till med incheckning, publikflöde och information.",
    location: "Göteborg",
    jobType: "temporary",
    active: true,
    createdAt: now,
  },
  {
    id: "job-events-2",
    companyId: "company-events",
    title: "Festivalhjälp",
    description: "Praktiskt stöd vid eventuppsättning och service.",
    location: "Göteborg",
    jobType: "temporary",
    active: true,
    createdAt: now,
  },
  {
    id: "job-log-1",
    companyId: "company-logistics",
    title: "Paketsorterare",
    description: "Sortera och märka paket på kvällspass.",
    location: "Malmö",
    jobType: "part-time",
    active: true,
    createdAt: now,
  },
  {
    id: "job-log-2",
    companyId: "company-logistics",
    title: "Lagerhjälp sommar",
    description: "Hjälpa till med in- och utleveranser under sommaren.",
    location: "Malmö",
    jobType: "summer",
    active: true,
    createdAt: now,
  },
];

const seededMatches: MatchRecord[] = [
  {
    id: "match-demo-1",
    companyId: "company-cafe",
    youthId: "youth-demo",
    jobId: "job-cafe-1",
    createdAt: now,
  },
  {
    id: "match-demo-2",
    companyId: "company-events",
    youthId: "youth-demo",
    jobId: "job-events-1",
    createdAt: now,
  },
];

const seededMessages: MatchMessage[] = [
  {
    id: "msg-demo-1",
    matchId: "match-demo-1",
    senderId: "company-cafe",
    message: "Hej Maja! Kul att du matchade med oss. Kan du jobba på lördag?",
    createdAt: now,
  },
  {
    id: "msg-demo-2",
    matchId: "match-demo-1",
    senderId: "youth-demo",
    message: "Hej! Ja, jag kan jobba lördag efter kl 10.",
    createdAt: now,
  },
  {
    id: "msg-demo-3",
    matchId: "match-demo-2",
    senderId: "company-events",
    message: "Hej! Vi söker hjälp till ett event nästa vecka.",
    createdAt: now,
  },
];

const seedDatabase: Database = {
  users: seededUsers,
  youthProfiles: seededYouthProfiles,
  companyProfiles: seededCompanyProfiles,
  jobs: seededJobs,
  youthActions: [],
  companyDecisions: [],
  matches: seededMatches,
  matchMessages: seededMessages,
  notifications: [],
};

function normalizeDb(parsed: Partial<Database>): Database {
  return {
    users: Array.isArray(parsed.users) ? parsed.users : [],
    youthProfiles: Array.isArray(parsed.youthProfiles) ? parsed.youthProfiles : [],
    companyProfiles: Array.isArray(parsed.companyProfiles) ? parsed.companyProfiles : [],
    jobs: Array.isArray(parsed.jobs) ? parsed.jobs : [],
    youthActions: Array.isArray(parsed.youthActions) ? parsed.youthActions : [],
    companyDecisions: Array.isArray(parsed.companyDecisions) ? parsed.companyDecisions : [],
    matches: Array.isArray(parsed.matches) ? parsed.matches : [],
    matchMessages: Array.isArray(parsed.matchMessages) ? parsed.matchMessages : [],
    notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [],
  };
}

async function ensureDbFile(): Promise<void> {
  await fs.mkdir(DB_DIR, { recursive: true });
  try {
    await fs.access(DB_FILE);
  } catch {
    await fs.writeFile(DB_FILE, JSON.stringify(seedDatabase, null, 2), "utf8");
  }
}

async function writeDb(db: Database): Promise<void> {
  await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2), "utf8");
}

let updateQueue: Promise<void> = Promise.resolve();

export async function readDb(): Promise<Database> {
  await ensureDbFile();
  try {
    const raw = await fs.readFile(DB_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<Database>;
    return normalizeDb(parsed);
  } catch {
    await writeDb(seedDatabase);
    return seedDatabase;
  }
}

export async function updateDb<T>(mutate: (db: Database) => T): Promise<T> {
  let result: T;
  const run = async () => {
    const db = await readDb();
    result = mutate(db);
    await writeDb(db);
  };
  updateQueue = updateQueue.then(run, run);
  await updateQueue;
  return result!;
}

export function createId(): string {
  return randomUUID();
}

