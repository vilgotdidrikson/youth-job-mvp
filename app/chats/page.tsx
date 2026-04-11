"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { LanguageToggle } from "@/components/language-toggle";
import { useLanguage } from "@/hooks/use-language";
import { useSession } from "@/hooks/use-session";
import { getMessages, sendMessage } from "@/lib/chat";
import { getMyConversations } from "@/lib/feeds";
import { getJobs } from "@/lib/jobs";
import type { ChatMessage, ConversationSummary, JobPost } from "@/lib/types";

export default function ChatsPage() {
  const { language, toggleLanguage } = useLanguage();
  const { user, loading } = useSession();

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [jobs, setJobs] = useState<JobPost[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;

    void (async () => {
      try {
        const [convData, jobsData] = await Promise.all([getMyConversations(), getJobs()]);
        setConversations(convData);
        setJobs(jobsData);
        setError("");

        if (convData[0]) {
          setSelectedConversationId(convData[0].id);
        }
      } catch (loadError) {
        console.error("Failed to load conversations.", loadError);
        setError(loadError instanceof Error ? loadError.message : "Unable to load conversations.");
      }
    })();
  }, [user]);

  useEffect(() => {
    if (!selectedConversationId) {
      return;
    }

    void (async () => {
      try {
        const data = await getMessages(selectedConversationId);
        setMessages(data);
      } catch (messageError) {
        console.error("Failed to load conversation messages.", messageError);
        setError(messageError instanceof Error ? messageError.message : "Unable to load messages.");
      }
    })();
  }, [selectedConversationId]);

  const t =
    language === "sv"
      ? {
          home: "Startsida",
          title: "Matcher & chattar",
          subtitle: "NÃ¤r bÃ¥da Ã¤r intresserade startas en konversation hÃ¤r.",
          loading: "Laddar...",
          empty: "Inga matcher Ã¤nnu. Swipea och vÃ¤nta pÃ¥ svar frÃ¥n fÃ¶retag.",
          messagePlaceholder: "Skriv meddelande...",
          send: "Skicka",
          failed: "Kunde inte ladda chattarna.",
        }
      : {
          home: "Home",
          title: "Matches & chats",
          subtitle: "When both sides are interested, the conversation starts here.",
          loading: "Loading...",
          empty: "No matches yet. Keep swiping and wait for company replies.",
          messagePlaceholder: "Write a message...",
          send: "Send",
          failed: "Unable to load chats.",
        };

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversationId),
    [conversations, selectedConversationId],
  );
  const visibleMessages = selectedConversationId ? messages : [];

  const selectedJob = selectedConversation?.job_id
    ? jobs.find((job) => job.id === selectedConversation.job_id)
    : undefined;

  const handleSend = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedConversationId || !draft.trim()) return;

    const body = draft.trim();
    setDraft("");

    try {
      await sendMessage(selectedConversationId, body);
      const data = await getMessages(selectedConversationId);
      setMessages(data);
    } catch (sendError) {
      console.error("Failed to send message.", sendError);
      setError(sendError instanceof Error ? sendError.message : "Unable to send message.");
      setDraft(body);
    }
  };

  if (loading || !user) {
    return (
      <main className="mobile-shell flex flex-col justify-center">
        <div className="glass-card p-6 text-sm text-[#2d4f72]">{t.loading}</div>
      </main>
    );
  }

  return (
    <main className="mobile-shell pb-8">
      <div className="mb-4 flex items-center justify-between gap-2">
        <Link href="/" className="secondary-btn px-3 py-2 text-xs">
          {t.home}
        </Link>
        <LanguageToggle language={language} onToggle={toggleLanguage} />
      </div>

      <div className="glass-card p-4">
        <h1 className="text-2xl font-semibold text-[#132742]">{t.title}</h1>
        <p className="mt-2 text-sm text-[#3f5f82]">{t.subtitle}</p>
      </div>

      {error ? (
        <div className="mt-3 glass-card p-5 text-sm text-[#9e3a2d]">{error || t.failed}</div>
      ) : conversations.length === 0 ? (
        <div className="mt-3 glass-card p-5 text-sm text-[#3f5f82]">{t.empty}</div>
      ) : (
        <>
          <div className="mt-3 flex gap-2 overflow-auto pb-1">
            {conversations.map((conversation) => {
              const active = conversation.id === selectedConversationId;
              const job = conversation.job_id
                ? jobs.find((item) => item.id === conversation.job_id)
                : undefined;

              return (
                <button
                  key={conversation.id}
                  type="button"
                  className={`rounded-xl border px-3 py-2 text-xs ${
                    active ? "border-[#88bcff] bg-[#e7f1ff] text-[#13497f]" : "border-[#cfe2ff] bg-white text-[#47688e]"
                  }`}
                  onClick={() => setSelectedConversationId(conversation.id)}
                >
                  {job?.title ?? "Conversation"}
                </button>
              );
            })}
          </div>

          <section className="mt-3 glass-card flex min-h-[360px] flex-col p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#4c6887]">
              {selectedJob?.title ?? "Conversation"}
            </p>

            <div className="mt-3 flex-1 space-y-2 overflow-auto rounded-xl bg-[#f7fbff] p-3">
              {visibleMessages.map((message) => (
                <div
                  key={message.id}
                  className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm ${
                    message.sender_user_id === user.id
                      ? "ml-auto bg-[#e7f1ff] text-[#13497f]"
                      : "bg-white text-[#2e4f75]"
                  }`}
                >
                  {message.text ?? message.body}
                </div>
              ))}
            </div>

            <form className="mt-3 flex gap-2" onSubmit={handleSend}>
              <input
                className="h-11 flex-1 rounded-xl border border-[#cfe2ff] px-3 text-sm"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={t.messagePlaceholder}
              />
              <button type="submit" className="cta-btn min-h-11 px-4 text-sm">
                {t.send}
              </button>
            </form>
          </section>
        </>
      )}
    </main>
  );
}
