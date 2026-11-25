import { csvCell } from "@/lib/prelaunch";
import { prelaunchAdmin } from "@/lib/prelaunch-server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
export async function GET(request: Request) {
  try {
    const db = await prelaunchAdmin(request);
    if (!db) return Response.json({ error: "Endast administratörer har åtkomst." }, { status: 403, headers });
    const params = new URL(request.url).searchParams;
    const role = params.get("role");
    if (role && !["youth", "company"].includes(role)) return Response.json({ error: "Ogiltig målgrupp." }, { status: 400, headers });
    const csv = params.get("format") === "csv";
    const rows: Record<string, unknown>[] = [];
    let total = 0;
    for (let offset = 0; ; offset += 500) {
      let query = db.from("prelaunch_signups").select("id,role,name,email,company_name,created_at,consent_version,notified_at,unsubscribe_token", { count: "exact" }).is("unsubscribed_at", null).order("created_at").order("id").range(offset, offset + (csv ? 499 : 99));
      if (role) query = query.eq("role", role);
      const { data, error, count } = await query;
      if (error) throw error;
      total = count ?? 0;
      rows.push(...(data ?? []));
      if (!csv || !data || data.length < 500) break;
      if (rows.length >= 50000) return Response.json({ error: "För många anmälningar. Exportera en målgrupp i taget." }, { status: 413, headers });
    }
    if (!csv) return Response.json({ total, rows: rows.map(({ unsubscribe_token: _token, ...row }) => row) }, { headers });
    const columns = ["Målgrupp", "Namn", "E-post", "Företag", "Anmäld", "Samtyckesversion", "Notifierad", "Avregistreringslänk"];
    const lines = [columns.map(csvCell).join(";"), ...rows.map(row => [row.role === "youth" ? "Ungdom" : "Företag", row.name, row.email, row.company_name, row.created_at, row.consent_version, row.notified_at, `https://matchnwork.se/avregistrera?token=${row.unsubscribe_token}`].map(csvCell).join(";"))];
    return new Response("\uFEFF" + lines.join("\r\n"), { headers: { ...headers, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="matchnwork-${role || "alla"}.csv"` } });
  } catch { return Response.json({ error: "Kunde inte hämta anmälningar." }, { status: 503, headers }); }
}
