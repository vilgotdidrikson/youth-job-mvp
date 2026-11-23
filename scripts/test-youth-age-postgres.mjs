import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
try {
  await db.exec(`create schema private;
    create table public.youth_profiles (id int primary key, date_of_birth date, age int, note text);
    insert into public.youth_profiles values (1, null, 14, null);`);
  await db.exec(readFileSync(new URL("../supabase/migrations/20261123100000_l15_validate_youth_age.sql", import.meta.url), "utf8"));
  const today = "(now() at time zone 'Europe/Stockholm')::date";
  const cutoff = `(${today} - interval '15 years')::date`;
  await db.exec("insert into public.youth_profiles(id) values (2)");
  await db.exec("update public.youth_profiles set note = 'unrelated legacy edit' where id = 1");
  await assert.rejects(db.exec("insert into public.youth_profiles(id,age) values (3,14)"), { code: "22023" });
  await assert.rejects(db.exec(`update public.youth_profiles set date_of_birth = ${cutoff} + 1, age = 18 where id = 2`), { code: "22023" });
  await assert.rejects(db.exec(`update public.youth_profiles set date_of_birth = ${today} + 1 where id = 2`), { code: "22023" });
  await db.exec(`update public.youth_profiles set date_of_birth = ${cutoff} where id = 2`);
  assert.equal((await db.query("select age from public.youth_profiles where id = 2")).rows[0].age, 15);
  await db.exec("update public.youth_profiles set age = 30 where id = 2");
  assert.equal((await db.query("select age from public.youth_profiles where id = 2")).rows[0].age, 15);
  console.log("PASS PostgreSQL age validation: incomplete and legacy profiles, 15-year boundary, future date and conflicting age.");
} finally {
  await db.close();
}
