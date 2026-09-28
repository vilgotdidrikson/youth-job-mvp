import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const STORAGE_PAGE_SIZE = 100;
const STORAGE_DELETE_BATCH_SIZE = 100;

type AdminClient = SupabaseClient<any, "public", any>;

async function listStorageFiles(admin: AdminClient, bucket: string, directory: string): Promise<string[]> {
  const files: string[] = [];

  for (let offset = 0; ; offset += STORAGE_PAGE_SIZE) {
    const { data: entries, error } = await admin.storage.from(bucket).list(directory, {
      limit: STORAGE_PAGE_SIZE,
      offset,
    });
    if (error) throw error;

    for (const entry of entries ?? []) {
      const path = `${directory}/${entry.name}`;
      if (entry.id) files.push(path);
      else files.push(...await listStorageFiles(admin, bucket, path));
    }

    if (!entries || entries.length < STORAGE_PAGE_SIZE) break;
  }

  return files;
}

async function removeUserStorage(admin: AdminClient, bucket: string, userId: string): Promise<void> {
  const files = await listStorageFiles(admin, bucket, userId);
  for (let index = 0; index < files.length; index += STORAGE_DELETE_BATCH_SIZE) {
    const { error } = await admin.storage.from(bucket).remove(files.slice(index, index + STORAGE_DELETE_BATCH_SIZE));
    if (error) throw error;
  }
}

export async function DELETE(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!token || !url || !anonKey) return NextResponse.json({ error: "Du måste vara inloggad." }, { status: 401 });
  if (!serviceKey) return NextResponse.json({ error: "Kontoborttagning är inte konfigurerad. Kontakta supporten." }, { status: 503 });
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: userData } = await userClient.auth.getUser(token);
  if (!userData.user) return NextResponse.json({ error: "Din session är inte giltig." }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { password?: string };
  if (!body.password) return NextResponse.json({ error: "Bekräfta ditt lösenord för att radera kontot." }, { status: 400 });
  const { data: verified, error: passwordError } = await userClient.auth.signInWithPassword({ email: userData.user.email ?? "", password: body.password });
  if (passwordError || verified.user?.id !== userData.user.id) return NextResponse.json({ error: "Lösenordet stämmer inte." }, { status: 403 });
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  try {
    await removeUserStorage(admin, "youth-documents", userData.user.id);
    await removeUserStorage(admin, "job-images", userData.user.id);
  } catch (storageError) {
    console.error("Failed to remove account-owned storage objects.", storageError);
    return NextResponse.json({ error: "Kunde inte radera uppladdade filer. Kontot har inte raderats." }, { status: 502 });
  }
  const { error } = await admin.auth.admin.deleteUser(userData.user.id);
  if (error) return NextResponse.json({ error: "Kunde inte radera kontot just nu." }, { status: 502 });
  return new NextResponse(null, { status: 204 });
}
