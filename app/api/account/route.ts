import { reauthenticateAccount, AccountReauthenticationError } from "@/lib/server/account-reauthentication";
import { reportServerFailure } from "@/lib/server-failures";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const STORAGE_PAGE_SIZE = 100;
const STORAGE_DELETE_BATCH_SIZE = 100;

type AdminClient = SupabaseClient;

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

async function getDeletionNotification(admin: AdminClient, userId: string) {
  const [{ data: profile, error: profileError }, { data: conversations, error: conversationsError }] = await Promise.all([
    admin.from("profiles").select("role").eq("id", userId).maybeSingle(),
    admin.from("conversations").select("youth_user_id, company_user_id").or(`youth_user_id.eq.${userId},company_user_id.eq.${userId}`),
  ]);
  if (profileError) throw profileError;
  if (conversationsError) throw conversationsError;

  const recipientIds = [...new Set((conversations ?? []).map((conversation) =>
    conversation.youth_user_id === userId ? conversation.company_user_id : conversation.youth_user_id,
  ))];
  const deletedAccountLabel = profile?.role === "company" ? "Ett företag" : "En användare";

  return recipientIds.map((recipientId) => ({
    user_id: recipientId,
    type: "account_deleted",
    title: "En chatt har stängts",
    body: `${deletedAccountLabel} som du har chattat med har raderat sitt konto. Chatten och historiken har därför tagits bort.`,
    href: "/notifications",
  }));
}

export async function DELETE(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!token || !url || !anonKey) return NextResponse.json({ error: "Du måste vara inloggad." }, { status: 401 });
  if (!serviceKey) return NextResponse.json({ error: "Kontoborttagning är inte konfigurerad. Kontakta supporten." }, { status: 503 });
  const userClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Bekräfta kontot och lösenordet." }, { status: 400 });
  const { password, expectedUserId } = body as Record<string, unknown>;
  if (typeof password !== "string" || !password || password.length > 1024 || typeof expectedUserId !== "string") return NextResponse.json({ error: "Bekräfta kontot och lösenordet." }, { status: 400 });
  const reauth = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  let user;
  try {
    user = await reauthenticateAccount(userClient, reauth, expectedUserId, password);
  } catch (error) {
    if (error instanceof AccountReauthenticationError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Kontot kunde inte verifieras just nu." }, { status: 502 });
  }
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  // Privileged accounts are offboarded by another administrator first, so the
  // platform can never lose its last admin through self-service deletion.
  const { data: adminMembership, error: adminLookupError } = await admin.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
  if (adminLookupError) return NextResponse.json({ error: "Kunde inte radera kontot just nu." }, { status: 502 });
  if (adminMembership) return NextResponse.json({ error: "Administratörskonton kan inte raderas här. Be en annan administratör att först ta bort din adminbehörighet." }, { status: 409 });
  let deletionNotifications: Awaited<ReturnType<typeof getDeletionNotification>> = [];
  try {
    deletionNotifications = await getDeletionNotification(admin, user.id);
  } catch (notificationLookupError) {
    // Notification delivery is helpful, but must never block a user's right to delete their account.
    reportServerFailure("account_delete_recipients_failed", notificationLookupError);
  }
  try {
    await removeUserStorage(admin, "youth-documents", user.id);
    await removeUserStorage(admin, "youth-profile-videos", user.id);
    await removeUserStorage(admin, "job-images", user.id);
    await removeUserStorage(admin, "personal-data-exports", user.id);
  } catch (storageError) {
    reportServerFailure("account_delete_files_failed", storageError);
    return NextResponse.json({ error: "Kunde inte radera uppladdade filer. Kontot har inte raderats." }, { status: 502 });
  }
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return NextResponse.json({ error: "Kunde inte radera kontot just nu." }, { status: 502 });
  if (deletionNotifications.length) {
    const { error: notificationError } = await admin.from("notifications").insert(deletionNotifications);
    if (notificationError) reportServerFailure("account_delete_notification_failed", notificationError);
  }
  return new NextResponse(null, { status: 204 });
}
