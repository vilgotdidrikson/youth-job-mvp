"use client";

import { useEffect, useState } from "react";
import { getBlockedContacts, unblockContact, type BlockedContact } from "@/lib/moderation";

export function BlockedContacts({ userId }: { userId: string }) {
  const [items, setItems] = useState<BlockedContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    getBlockedContacts(userId).then(data => { if (active) { setItems(data); setError(""); } })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Kunde inte hämta kontakter."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId, retry]);

  async function unblock(item: BlockedContact) {
    if (!window.confirm(`Häv blockeringen av ${item.name}? Kontakten kan då återupptas om den andra personen inte också har blockerat dig.`)) return;
    setBusy(item.userId); setError(""); setMessage("");
    try {
      await unblockContact(item.userId);
      setItems(current => current.filter(contact => contact.userId !== item.userId));
      setMessage(`Blockeringen av ${item.name} har hävts.`);
      window.dispatchEvent(new Event("mnw-navigation-refresh"));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Kunde inte häva blockeringen."); }
    finally { setBusy(null); }
  }

  return <section className="card mnw-profile-card" style={{ padding: "1.25rem", marginBlock: ".75rem" }} aria-labelledby="blocked-contacts-title">
    <h2 id="blocked-contacts-title">Blockerade kontakter</h2>
    <p>Här hanterar du kontakter som du själv har blockerat.</p>
    {loading ? <p role="status">Hämtar blockerade kontakter…</p> : !error && !items.length ? <p>Du har inga blockerade kontakter.</p> : null}
    {error && <div><p role="alert">{error}</p><button type="button" className="secondary-btn" disabled={busy !== null} onClick={() => { setLoading(true); setRetry(value => value + 1); }}>Försök igen</button></div>}
    {message && <p role="status">{message}</p>}
    {items.map(item => <div key={item.userId} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: ".75rem", paddingBlock: ".75rem", borderTop: "1px solid #f0d9e0" }}>
      <div><strong>{item.name}</strong><p style={{ margin: ".25rem 0", fontSize: ".85rem" }}>Blockerad {new Date(item.createdAt).toLocaleDateString("sv-SE")}</p></div>
      <button type="button" className="secondary-btn" disabled={busy !== null} onClick={() => void unblock(item)}>{busy === item.userId ? "Häver…" : "Häv blockering"}</button>
    </div>)}
  </section>;
}
