"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useSession } from "@/hooks/use-session";
import { useCvCompletion } from "@/hooks/use-cv-completion";
import { getMessages, getMyConversationContacts, getMyConversations, sendMessage, subscribeToConversationMessages } from "@/lib/chat";
import { getMyMatches } from "@/lib/matching";
import type { ChatMessage, ConversationSummary } from "@/lib/types";
import { useRouter } from "next/navigation";

interface ConvDisplay {
  conv: ConversationSummary;
  otherName: string;
  jobTitle?: string;
  status: string;
}

const statusLabels: Record<string, string> = { matched: "Matchad", in_contact: "Kontakt", interview: "Intervju", hired: "Anställd", rejected: "Avvisad", cancelled: "Avslutad" };

export default function ChatsPage() {
  const { user, profile, loading } = useSession();
  const router = useRouter();
  const { cvCompleted, cvLoading } = useCvCompletion(user?.id, profile?.role === "youth");
  const [convDisplays, setConvDisplays] = useState<ConvDisplay[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user || cvLoading || !cvCompleted) return;
    void loadConversations();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile?.role, cvCompleted, cvLoading]);

  const loadConversations = async () => {
    try {
      const [convs, contacts, matches] = await Promise.all([getMyConversations(), getMyConversationContacts(), getMyMatches()]);
      const contactMap = new Map(contacts.map((contact) => [contact.conversation_id, contact]));
      const matchStatusMap = new Map(matches.map((match) => [match.id, match.status ?? "matched"]));

      setConvDisplays(
        convs.map((conv) => ({
          conv,
          otherName: contactMap.get(conv.id)?.other_name ?? "Kontakt",
          jobTitle: contactMap.get(conv.id)?.job_title ?? undefined,
          status: conv.match_id ? matchStatusMap.get(conv.match_id) ?? "matched" : "matched",
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte ladda konversationer.");
    }
  };

  useEffect(() => {
    if (!selectedConvId) return;
    void (async () => {
      try {
        setMessages(await getMessages(selectedConvId));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Kunde inte ladda meddelanden.");
      }
    })();
  }, [selectedConvId]);

  useEffect(() => {
    if (!selectedConvId) return;
    return subscribeToConversationMessages(selectedConvId, (message) => {
      setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
      void loadConversations();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConvId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedConvId || !draft.trim()) return;
    const text = draft.trim();
    setDraft("");
    try {
      await sendMessage(selectedConvId, text);
      setMessages(await getMessages(selectedConvId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte skicka meddelande.");
      setDraft(text);
    }
  };

  if (loading || cvLoading || !user) {
    return (
      <main className="mobile-shell" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#737373", fontSize: "0.9rem" }}>Laddar...</p>
      </main>
    );
  }

  if (profile?.role === "youth" && !cvCompleted) {
    return (
      <main className="mobile-shell" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="card" style={{ padding: "1.25rem", textAlign: "center" }}>
          <p style={{ fontSize: "1.1rem", fontWeight: 700, color: "#111111", marginBottom: "0.4rem" }}>Slutför ditt CV först</p>
          <p style={{ fontSize: "0.85rem", color: "#737373", lineHeight: 1.5 }}>Du kan inte swipa jobb eller chatta med företag förrän du har slutfört ditt CV.</p>
          <button type="button" className="cta-btn" onClick={() => router.push("/youth/cv")} style={{ marginTop: "0.9rem", padding: "0.75rem 1rem" }}>Skapa mitt CV</button>
        </div>
      </main>
    );
  }

  const selectedDisplay = selectedConvId
    ? convDisplays.find((d) => d.conv.id === selectedConvId)
    : null;

  /* ── Chat detail view ───────────────────────────────────── */
  if (selectedConvId && selectedDisplay) {
    const initials = selectedDisplay.otherName
      .split(" ")
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();

    return (
      <main
        className="mobile-shell"
        style={{ display: "flex", flexDirection: "column" }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            paddingTop: "0.5rem",
            paddingBottom: "0.85rem",
            borderBottom: "1.5px solid #f0f0f0",
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={() => { setSelectedConvId(null); setMessages([]); setError(""); }}
            style={{
              background: "none", border: "none", cursor: "pointer",
              padding: "0.25rem 0.35rem", borderRadius: 8, fontSize: "1.1rem", color: "#111",
            }}
          >
            ←
          </button>
          <div
            style={{
              width: 38, height: 38, borderRadius: "50%",
              background: "#111", color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "0.78rem", fontWeight: 700, flexShrink: 0,
            }}
          >
            {initials || "?"}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: 700, fontSize: "0.97rem", color: "#111", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {selectedDisplay.otherName}
            </p>
            {selectedDisplay.jobTitle && (
              <p style={{ fontSize: "0.76rem", color: "#737373", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {selectedDisplay.jobTitle}
              </p>
            )}
            <p style={{ fontSize: "0.72rem", color: "#1a7f4b", margin: "0.12rem 0 0", fontWeight: 700 }}>{statusLabels[selectedDisplay.status] ?? selectedDisplay.status}</p>
          </div>
        </div>

        {error && (
          <div style={{ borderRadius: 10, background: "#fff1f0", border: "1px solid #ffd6d3", padding: "0.65rem 1rem", fontSize: "0.82rem", color: "#c0392b", margin: "0.5rem 0", flexShrink: 0 }}>
            {error}
          </div>
        )}

        {/* Messages */}
        <div
          style={{
            flex: 1, overflowY: "auto",
            display: "flex", flexDirection: "column", gap: "0.45rem",
            padding: "0.75rem 0 0.5rem",
          }}
        >
          {messages.length === 0 && (
            <p style={{ textAlign: "center", color: "#a3a3a3", fontSize: "0.85rem", padding: "2rem 0" }}>
              Inga meddelanden ännu. Säg hej! 👋
            </p>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                maxWidth: "80%",
                padding: "0.55rem 0.9rem",
                borderRadius: 16,
                fontSize: "0.9rem",
                lineHeight: 1.45,
                alignSelf: msg.sender_user_id === user.id ? "flex-end" : "flex-start",
                background: msg.sender_user_id === user.id ? "#111111" : "#ffffff",
                color: msg.sender_user_id === user.id ? "#ffffff" : "#111111",
                border: msg.sender_user_id === user.id ? "none" : "1.5px solid #e8e8e8",
              }}
            >
              {msg.message_text}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Send form */}
        <form
          style={{ display: "flex", gap: "0.5rem", paddingTop: "0.5rem", flexShrink: 0 }}
          onSubmit={handleSend}
        >
          <input
            className="input-field"
            style={{ flex: 1 }}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Skriv ett meddelande..."
          />
          <button
            type="submit"
            className="cta-btn"
            style={{ padding: "0 1rem", height: 48, flexShrink: 0 }}
          >
            Skicka
          </button>
        </form>
      </main>
    );
  }

  /* ── Inbox list view ───────────────────────────────────── */
  return (
    <main className="mobile-shell">
      <div style={{ marginBottom: "1.25rem", paddingTop: "0.5rem" }}>
        <p style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#a3a3a3", margin: 0 }}>
          Employo
        </p>
        <h1 style={{ fontSize: "1.6rem", fontWeight: 800, letterSpacing: "-0.03em", color: "#111111", margin: "0.2rem 0 0" }}>
          Matchningar
        </h1>
        <p style={{ marginTop: "0.3rem", fontSize: "0.85rem", color: "#737373" }}>
          När båda är intresserade öppnas en chatt här.
        </p>
      </div>

      {error && (
        <div style={{ borderRadius: 12, background: "#fff1f0", border: "1px solid #ffd6d3", padding: "0.75rem 1rem", fontSize: "0.85rem", color: "#c0392b", marginBottom: "0.75rem" }}>
          {error}
        </div>
      )}

      {convDisplays.length === 0 ? (
        <div style={{ textAlign: "center", paddingTop: "3rem" }}>
          <p style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>🤝</p>
          <p style={{ fontWeight: 700, fontSize: "1.1rem", color: "#111111", marginBottom: "0.4rem" }}>Inga matchningar ännu</p>
          <p style={{ fontSize: "0.85rem", color: "#737373" }}>Fortsätt swipa — matchningar låser upp chatt.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {convDisplays.map(({ conv, otherName, jobTitle }) => {
            const initials = otherName
              .split(" ")
              .map((w) => w[0])
              .slice(0, 2)
              .join("")
              .toUpperCase();
            return (
              <button
                key={conv.id}
                type="button"
                onClick={() => setSelectedConvId(conv.id)}
                style={{
                  display: "flex", alignItems: "center", gap: "0.85rem",
                  padding: "0.9rem 1rem",
                  borderRadius: 14,
                  background: "#fff",
                  border: "1.5px solid #e8e8e8",
                  cursor: "pointer",
                  textAlign: "left",
                  width: "100%",
                  transition: "border-color 0.15s ease",
                }}
              >
                <div
                  style={{
                    width: 44, height: 44, borderRadius: "50%",
                    background: "#111111", color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "0.85rem", fontWeight: 700, flexShrink: 0,
                  }}
                >
                  {initials || "?"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 700, fontSize: "0.95rem", color: "#111", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {otherName}
                  </p>
                  {jobTitle && (
                    <p style={{ fontSize: "0.8rem", color: "#737373", margin: "0.1rem 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {jobTitle}
                    </p>
                  )}
                  <span style={{ display: "inline-block", marginTop: ".25rem", fontSize: ".7rem", color: "#1a7f4b", fontWeight: 700 }}>{statusLabels[convDisplays.find((item) => item.conv.id === conv.id)?.status ?? "matched"] ?? "Matchad"}</span>
                </div>
                <span style={{ color: "#c0c0c0", fontSize: "1.25rem", flexShrink: 0, lineHeight: 1 }}>›</span>
              </button>
            );
          })}
        </div>
      )}
    </main>
  );
}
