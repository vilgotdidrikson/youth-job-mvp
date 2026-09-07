import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

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
  const prefix = `${userData.user.id}/`;
  const { data: documents } = await admin.storage.from("youth-documents").list(userData.user.id, { limit: 1000 });
  if (documents?.length) await admin.storage.from("youth-documents").remove(documents.map((file) => `${prefix}${file.name}`));
  const { error } = await admin.auth.admin.deleteUser(userData.user.id);
  if (error) return NextResponse.json({ error: "Kunde inte radera kontot just nu." }, { status: 502 });
  return new NextResponse(null, { status: 204 });
}
