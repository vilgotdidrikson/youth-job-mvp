import { createHmac } from "node:crypto";
import type { prelaunchDb } from "./prelaunch-server";
type Db = ReturnType<typeof prelaunchDb>;
// Conditional updates make reservations atomic across server instances.
// Future window_start keeps these namespaced counters through the existing
// waitlist cleanup until their actual expiry, without changing signup counters.
async function reserve(db: Db, bucket: string, limit: number, expires: Date) {
  for (let retry = 0; retry < 3; retry++) {
    const existing = await db
      .from("prelaunch_rate_limits")
      .select("attempts")
      .eq("bucket", bucket)
      .maybeSingle();
    if (existing.error) throw new Error("Quota unavailable");
    if (!existing.data) {
      const inserted = await db
        .from("prelaunch_rate_limits")
        .insert({ bucket, attempts: 1, window_start: expires.toISOString() });
      if (!inserted.error) return true;
      if (inserted.error.code === "23505") continue;
      throw new Error("Quota unavailable");
    }
    if (existing.data.attempts >= limit) return false;
    const updated = await db
      .from("prelaunch_rate_limits")
      .update({ attempts: existing.data.attempts + 1 })
      .eq("bucket", bucket)
      .eq("attempts", existing.data.attempts)
      .select("bucket")
      .maybeSingle();
    if (updated.error) throw new Error("Quota unavailable");
    if (updated.data) return true;
  }
  return false;
}
export async function consumeDemoChatQuota(
  db: Db,
  secret: string,
  ip: string,
  now = new Date(),
) {
  const minute = Math.floor(now.getTime() / 60000);
  const day = now.toISOString().slice(0, 10);
  const dayExpiry = new Date(`${day}T00:00:00.000Z`);
  dayExpiry.setUTCDate(dayExpiry.getUTCDate() + 1);
  const hash = (value: string) =>
    createHmac("sha256", secret).update(`demo-chat:v1:${value}`).digest("hex");
  return (
    (await reserve(
      db,
      hash(`ip-minute:${ip}:${minute}`),
      6,
      new Date((minute + 1) * 60000),
    )) &&
    (await reserve(db, hash(`ip-day:${ip}:${day}`), 30, dayExpiry)) &&
    (await reserve(db, hash(`global-day:${day}`), 500, dayExpiry))
  );
}
