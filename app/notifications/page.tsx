"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "@/hooks/use-session";
import { getSupabaseClient } from "@/lib/supabase";

type Notification = { id: string; title: string; body: string; href: string | null; read_at: string | null; created_at: string };

export default function NotificationsPage() {
  const { user, loading } = useSession();
  const [items, setItems] = useState<Notification[]>([]); const [error, setError] = useState("");
  useEffect(() => { if (!user) return; void getSupabaseClient().from("notifications").select("*").order("created_at", { ascending: false }).limit(50).then(({ data, error: loadError }) => { if (loadError) setError("Kunde inte läsa notiser."); else setItems((data ?? []) as Notification[]); }); }, [user]);
  const read = async (item: Notification) => { if (!item.read_at) { await getSupabaseClient().from("notifications").update({ read_at: new Date().toISOString() }).eq("id", item.id); setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, read_at: new Date().toISOString() } : entry)); } };
  if (loading) return <main className="mobile-shell"><p>Laddar...</p></main>;
  if (!user) return <main className="mobile-shell"><p>Logga in för att se notiser.</p></main>;
  return <main className="mobile-shell"><h1>Notiser</h1>{error && <p>{error}</p>}{items.length === 0 ? <p>Du har inga notiser ännu.</p> : items.map((item) => <Link key={item.id} href={item.href || "/notifications"} onClick={() => void read(item)} className="card" style={{ display: "block", padding: "1rem", marginBottom: ".65rem", textDecoration: "none", color: "inherit", opacity: item.read_at ? .7 : 1 }}><strong>{item.title}</strong><p style={{ margin: ".35rem 0 0" }}>{item.body}</p></Link>)}</main>;
}
