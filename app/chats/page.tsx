"use client";

import Link from "next/link";
import { FormEvent, Suspense, useCallback, useEffect, useRef, useState } from "react";
import {useSearchParams} from "next/navigation";
import {NotificationLink} from "@/components/notification-link";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { AuthGateMessage } from "@/components/auth-gate-message";
import { useCvCompletion } from "@/hooks/use-cv-completion";
import { useConversationRetention } from "@/hooks/use-data-retention";
import { ConversationRetentionNotice } from "@/components/data-retention-notice";
import { getMessages, subscribeToConversationMessages } from "@/lib/chat";
import { readChatInbox, type ChatInboxItem } from "@/lib/chat-inbox";
import { createChatTextSender } from "@/lib/chat-text-sender";
import { createLatestRead } from "@/lib/latest-read";
import { chatRequestKey, isRequestedConversation } from "@/lib/chat-navigation";
import { RecruitmentPanel } from "@/components/recruitment-panel";
import { employmentStatusLabel } from "@/lib/recruitment-types";
import type { ChatMessage, Role } from "@/lib/types";
import { ReportDialog } from "@/components/report-dialog";
import { ChatVideoComposer, VideoMessage } from "@/components/chat-video";
import { blockConversationUser } from "@/lib/moderation";
import { markMatchNotificationsRead } from "@/lib/notifications";
import { UiIcon } from "@/components/ui-icon";
import styles from "./chat.module.css";
import { chatIsReadOnly } from "@/lib/application-withdrawal";
import { subscribeVisibleRefresh } from "@/lib/visible-refresh";

const statusLabels: Record<string, string> = { matched: "Matchad", in_contact: "Kontakt pågår", interview: "Intervju", hired: employmentStatusLabel(), rejected: "Avslutad", cancelled: "Avslutad" };
const initials = (name: string) => name.split(" ").filter(Boolean).slice(0,2).map(word => word[0]).join("").toUpperCase();
function messageTime(value: unknown) { const date = new Date(String(value ?? "")); return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("sv-SE", { hour:"2-digit", minute:"2-digit" }).format(date); }
function messageDate(value: unknown) { const date = new Date(String(value ?? "")); return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("sv-SE", {day:"numeric", month:"long"}).format(date); }
function mergeMessages(a: ChatMessage[], b: ChatMessage[]) {
  return [...new Map([...a,...b].map(item => [item.id,item])).values()].sort((x,y) => String(x.created_at ?? "").localeCompare(String(y.created_at ?? "")));
}

function ChatsPageContent() {
  const { user, profile, status, error: sessionError } = useRequireAuth();
  if(status !== "ready") return <AuthGateMessage status={status} error={sessionError}/>;
  if(!user || !profile) return <AuthGateMessage status="checking"/>;
  return <ChatsWorkspace key={user.id} user={user} profile={profile}/>;
}

function ChatsWorkspace({ user, profile }: { user: { id: string }; profile: { role: Role } }) {
  const { cvCompleted, cvLoading } = useCvCompletion(user?.id, profile?.role === "youth");
  const [conversations, setConversations] = useState<ChatInboxItem[]>([]), [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<{id:string; items:ChatMessage[]}>({id:"",items:[]});
  const [drafts, setDrafts] = useState<Record<string,string>>({}), [search, setSearch] = useState("");
  const [listState, setListState] = useState<"loading" | "ready" | "error">("loading"), [loadedId, setLoadedId] = useState("");
  const [error, setError] = useState(""), [messageError, setMessageError] = useState(""), [sending, setSending] = useState(false);
  const [historyRetry, setHistoryRetry] = useState(0);
  const retention = useConversationRetention(selectedId, user?.id);
  const [blocking, setBlocking] = useState(false);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null), selectedRef = useRef<string | null>(null), sendLock = useRef(false);
  const active = useRef(false), foreground = useRef(true);
  const inboxReader = useRef<ReturnType<typeof createLatestRead<ChatInboxItem[], boolean>> | null>(null);
  const sender = useRef<ReturnType<typeof createChatTextSender> | null>(null);
  useEffect(() => {
    active.current = true;
    const current = createChatTextSender(user.id); sender.current = current;
    return () => { active.current = false; current.stop(); if(sender.current === current) sender.current = null; };
  }, [user.id]);
  const query=useSearchParams(), requestedJob=query.get("job"), requestedConversation=query.get("conversation"), requestedMatch=query.get("match");
  const openedRequest=useRef("");
  useEffect(()=>{const input=composerRef.current;if(input){input.style.height="auto";input.style.height=`${Math.min(120,input.scrollHeight)}px`;}},[selectedId,drafts]);
  // A separate recording page must not discard an unfinished chat message.
  useEffect(()=>{
    if(!selectedId||!user?.id)return;
    const id=selectedId;let cached="";
    try{cached=sessionStorage.getItem(`mnw-chat-draft:${user.id}:${id}`)||"";}catch{return;}
    if(!cached)return;
    const timer=setTimeout(()=>setDrafts(current=>current[id]?current:{...current,[id]:cached}),0);
    return()=>clearTimeout(timer);
  },[selectedId,user?.id]);
  const loadConversations = useCallback((showLoading = true) => {
    foreground.current = showLoading;
    return inboxReader.current?.load(showLoading) ?? Promise.resolve();
  }, []);
  const canLoad = !cvLoading && (profile.role !== "youth" || cvCompleted);
  useEffect(() => {
    if(!canLoad) return;
    const reader = createLatestRead<ChatInboxItem[], boolean>({
      read: (_, signal) => readChatInbox(user.id, signal),
      errorMessage: "Kunde inte läsa dina chattar. Försök igen.",
      update: state => {
      if(state.status === "loading") { if(foreground.current) setListState("loading"); return; }
      if(state.status === "error") { setError(state.message); setListState(current => foreground.current || current === "loading" ? "error" : current); return; }
      const display = state.value;
      setConversations(display);
      if(selectedRef.current && !display.some(item => item.conv.id === selectedRef.current)) {
        selectedRef.current = null; setSelectedId(null); setLoadedId(""); setMessages({ id: "", items: [] });
      }
      const request={conversationId:requestedConversation,matchId:requestedMatch,jobId:requestedJob};
      const requestKey=chatRequestKey(request);
      const target=display.find(item=>isRequestedConversation(item.conv,request));
      if(target && openedRequest.current!==requestKey) {openedRequest.current=requestKey;selectedRef.current=target.conv.id;setSelectedId(target.conv.id);setLoadedId("");setMessageError("");}
      setListState("ready"); setError("");
      },
    });
    inboxReader.current = reader; foreground.current = true; void reader.load(true);
    return () => { reader.stop(); if(inboxReader.current === reader) inboxReader.current = null; };
  }, [user.id,canLoad,requestedJob,requestedConversation,requestedMatch]);
  useEffect(() => subscribeVisibleRefresh(() => loadConversations(false)), [loadConversations]);
  useEffect(() => {
    if(!selectedId) return;
    let active = true;
    const unsubscribe = subscribeToConversationMessages(selectedId,message => {
      if(!active || message.conversation_id !== selectedId) return;
      setMessages(current => ({id:selectedId, items:mergeMessages(current.id === selectedId ? current.items : [],[message])}));
      void loadConversations(false);
    });
    const reader = createLatestRead<ChatMessage[]>({
      read: (_, signal) => getMessages(selectedId, signal),
      update: state => {
        if(state.status === "ready") {
          setMessages(current => ({id:selectedId, items:mergeMessages(state.value,current.id === selectedId ? current.items : [])})); setLoadedId(selectedId);
        } else if(state.status === "error") setMessageError(state.message);
      }, errorMessage: "Kunde inte läsa meddelanden. Hämta historiken igen.",
    });
    void reader.load();
    return () => { active = false; reader.stop(); unsubscribe(); };
  },[selectedId,loadConversations,historyRetry]);
  useEffect(() => { bottomRef.current?.scrollIntoView({behavior:"instant",block:"nearest"}); },[messages]);
  // An open, visible conversation has been seen: clear its match and message notices and badges.
  const openMatchId = loadedId && loadedId === selectedId ? conversations.find(item => item.conv.id === loadedId)?.matchId : undefined;
  const seenCount = messages.id === loadedId ? messages.items.length : 0;
  useEffect(() => {
    if(!user?.id || !openMatchId) return;
    const userId = user.id, matchId = openMatchId;
    const markSeen = () => { if(document.visibilityState === "visible") void markMatchNotificationsRead(userId,matchId).then(changed => { if(changed) window.dispatchEvent(new Event("mnw-navigation-refresh")); }).catch(() => {}); };
    markSeen();
    document.addEventListener("visibilitychange",markSeen);
    return () => document.removeEventListener("visibilitychange",markSeen);
  },[user?.id,openMatchId,seenCount]);
  const select = (id: string | null) => {
    if (id === selectedRef.current) return;
    selectedRef.current=id; setSelectedId(id); setLoadedId(""); setMessageError("");  setError("");
  };
  const retryMessages = () => { setMessageError(""); setLoadedId(""); setHistoryRetry(current => current + 1); };
  const handleSend = async (event: FormEvent) => {
    event.preventDefault();
    const id = selectedId, text = id ? drafts[id]?.trim() : "";
    if(!active.current || !sender.current || !id || !text || loadedId !== id || retention.writeBlocked || sendLock.current || chatIsReadOnly(conversations.find(item => item.conv.id === id)?.status || "")) return;
    sendLock.current=true; setSending(true); setMessageError("");
    try {
      const confirmed = await sender.current.send(id,text);
      if(!confirmed || !active.current) return;
      try{const key=`mnw-chat-draft:${user?.id}:${id}`;if(sessionStorage.getItem(key)?.trim()===text)sessionStorage.removeItem(key);}catch{/* Storage may be disabled. */}
      setDrafts(current => ({...current,[id]:current[id]?.trim() === text ? "" : current[id]}));

      if(selectedRef.current === id) retryMessages();
      void loadConversations(false);
    } catch(reason) { if(active.current && selectedRef.current === id) setMessageError(reason instanceof Error ? reason.message : "Sändningen kunde inte bekräftas. Texten finns kvar. Försök igen för att kontrollera samma meddelande."); }
    finally { sendLock.current=false; if(active.current) setSending(false); }
  };
  const selected = conversations.find(item => item.conv.id === selectedId);
  const handleBlock = async () => {
    if(!selected || blocking || !window.confirm(`Blockera ${selected.otherName}? Ingen av er kommer kunna skicka fler meddelanden i chatten.`)) return;
    setBlocking(true); try { await blockConversationUser(selected.conv.id); select(null); setMessages({id:"",items:[]}); await loadConversations(false); } catch(reason) { setError(reason instanceof Error ? reason.message : "Kunde inte blockera användaren."); } finally { setBlocking(false); }
  };
  if(cvLoading) return <main className={styles.page}><section className={styles.empty} role="status">Hämtar dina chattar…</section></main>;
  if(profile?.role === "youth" && !cvCompleted) return <main className={`${styles.page} ${styles.cvGate}`}><section className={styles.empty}><span className={styles.emptyIcon}><UiIcon name="chat" width="30" height="30"/></span><h1>Gör klart ditt CV</h1><p>Ett färdigt CV behövs för att skicka din ansökan. När ni båda är intresserade öppnas chatten här.</p><Link className={styles.primary} href="/youth/cv">Fortsätt med CV:t <UiIcon name="arrow"/></Link></section></main>;
  const visible = conversations.filter(item => `${item.otherName} ${item.jobTitle}`.toLocaleLowerCase("sv").includes(search.toLocaleLowerCase("sv")));
  const currentMessages = messages.id === selectedId ? messages.items : [];
  const isCompany = profile?.role === "company";
  const emptyNextStep = isCompany
    ? <Link href="/company?view=kandidater" className={styles.primary}>Granska kandidater <UiIcon name="arrow"/></Link>
    : <><Link href="/swipe" className={styles.primary}>Upptäck jobb <UiIcon name="arrow"/></Link><Link href="/applications" className={styles.secondary}>Se dina ansökningar</Link></>;

  return <main className={`${styles.page} ${selected ? styles.hasConversation : ""}`}>
    <header className={styles.heading}><div className={styles.headingRow}><div className={styles.headingTitle}><Link href={profile?.role==="youth" ? "/applications" : "/company?view=kandidater"} className={styles.back}><UiIcon name="arrow"/>Tillbaka</Link><h1>Meddelanden</h1></div><NotificationLink/></div></header>
    <div className={styles.workspace}><aside className={styles.inbox} aria-label="Inkorg"><div className={styles.inboxHeader}><h2>Meddelanden <span>{conversations.length}</span></h2><label className={styles.search}><span className="sr-only">Sök bland chattar</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Sök namn eller jobb"/></label></div>
      {error && listState !== "error" && <div className={styles.listNote}><p role="alert">{error}</p><button type="button" className={styles.secondary} onClick={() => void loadConversations()}>Försök igen</button></div>}
      {listState === "loading" ? <p className={styles.listNote} role="status">Hämtar matchningar…</p> : listState === "error" ? <div className={styles.listNote}><p role="alert">{error}</p><button className={styles.secondary} onClick={() => void loadConversations()}>Försök igen</button></div> : visible.length === 0 ? <div className={`${styles.listNote} ${search ? "" : styles.inboxEmpty}`}><UiIcon name="chat"/><h3>{search ? "Ingen chatt hittades" : "Dina matchningar landar här"}</h3><p>{search ? "Prova ett annat namn eller jobb." : "När båda visar intresse kan ni börja prata."}</p>{!search && <div className={styles.listActions}>{emptyNextStep}</div>}</div> : <div className={styles.contacts}>{visible.map(item => <button key={item.conv.id} className={`${styles.contact} ${selectedId === item.conv.id ? styles.contactActive : ""}`} type="button" aria-pressed={selectedId === item.conv.id} onClick={() => select(item.conv.id)}><span className={styles.avatar}>{initials(item.otherName)}</span><span className={styles.contactText}><strong>{item.otherName}</strong><span>{item.jobTitle || "Din matchning"}</span><small>{statusLabels[item.status] || item.status}</small></span><UiIcon name="arrow" width="16"/></button>)}</div>}
    </aside><section className={styles.conversation} aria-label={selected ? `Samtal med ${selected.otherName}` : "Konversation"}>{selected ? <>
      <header className={styles.conversationHeader}><button className={styles.mobileBack} type="button" aria-label="Tillbaka till inkorgen" onClick={() => select(null)}><UiIcon name="arrow"/></button><span className={styles.avatar}>{initials(selected.otherName)}</span><div><h2>{selected.otherName}</h2><p>{selected.jobTitle || "Din matchning"}</p></div><span className={styles.matchStatus}>{statusLabels[selected.status] || selected.status}</span><details className={styles.options}><summary aria-label="Alternativ för chatten">•••</summary><div>{selected.conv.job_id && <Link className={styles.jobLink} href={`/jobb/${selected.conv.job_id}`}>Visa jobbannons</Link>}<ReportDialog targetType="conversation" targetId={selected.conv.id} label="Anmäl chatt"/><button type="button" disabled={blocking} onClick={() => void handleBlock()}>{blocking ? "Blockerar…" : "Blockera kontakt"}</button></div></details></header>

      {selected.matchId && <details className={styles.nextSteps} key={selected.matchId}><summary>Jobbet och nästa steg</summary><RecruitmentPanel compact matchId={selected.matchId} company={profile?.role === "company"} onChanged={() => void loadConversations(false)} /></details>}
      <div className={styles.messages} aria-label="Meddelanden">{retention.value?.expired ? <p className={styles.messageNote} role="status">{retention.value.purged_at ? "Chattens meddelanden har raderats." : "Chattens meddelanden är inte längre tillgängliga."}</p> : loadedId !== selectedId ? <p className={styles.messageNote} role="status">{messageError ? "Meddelandena kunde inte hämtas." : "Hämtar meddelanden…"}</p> : currentMessages.length === 0 ? <div className={styles.welcome}><UiIcon name="discover"/><h3>Ni har matchat!</h3><p>{profile?.role === "company" ? "Presentera jobbet och ta nästa steg tillsammans." : "Säg hej och berätta lite om dig själv."}</p></div> : currentMessages.map((message,index) => <div className={styles.messageGroup} key={message.id}>{(index === 0 || messageDate(currentMessages[index - 1].created_at) !== messageDate(message.created_at)) && <p className={styles.date}>{messageDate(message.created_at)}</p>}<div className={`${styles.bubble} ${message.sender_user_id === user?.id ? styles.mine : ""}`}>{!message.video_kind&&<p>{message.message_text}</p>}{message.video_kind&&<VideoMessage message={message} own={message.sender_user_id===user?.id}/>}<time dateTime={String(message.created_at ?? "")}>{messageTime(message.created_at)}</time></div></div>)}<div ref={bottomRef}/></div>

      {messageError && <div className={styles.error}><p role="alert">{messageError}</p><button type="button" className={styles.secondary} disabled={sending} onClick={retryMessages}>Hämta meddelanden igen</button></div>}

      <ConversationRetentionNotice value={retention.value} state={retention.state} retry={retention.retry}/>
      {chatIsReadOnly(selected.status) && !retention.value?.expired ? <p className={styles.messageNote} role="status">Rekryteringen är avslutad. Chatthistoriken finns kvar att läsa, men ni kan inte skicka fler meddelanden.</p> : retention.writeBlocked ? null : <>
      {user&&profile?.role==='youth'&&loadedId===selectedId&&<ChatVideoComposer key={selected.conv.id} conversationId={selected.conv.id} userId={user.id} onSent={()=>{retryMessages();void loadConversations(false);}}/>}
      <form className={styles.composer} onSubmit={handleSend}><label><span className="sr-only">Meddelande till {selected.otherName}</span><textarea ref={composerRef} rows={1} value={drafts[selected.conv.id] || ""} onChange={event => {const input=event.currentTarget;input.style.height="auto";input.style.height=`${Math.min(120,input.scrollHeight)}px`;const value=input.value;try{sessionStorage.setItem(`mnw-chat-draft:${user?.id}:${selected.conv.id}`,value);}catch{/* Storage may be disabled. */}setDrafts(current => ({...current,[selected.conv.id]:value}));}} onKeyDown={event=>{if(event.key==="Enter"&&!event.shiftKey&&!event.nativeEvent.isComposing&&window.matchMedia("(pointer:fine)").matches){event.preventDefault();event.currentTarget.form?.requestSubmit();}}} placeholder="Skriv ett meddelande…" disabled={sending || loadedId !== selectedId}/></label><button type="submit" aria-label={sending ? "Skickar meddelande" : "Skicka meddelande"} disabled={sending || loadedId !== selectedId || !drafts[selected.conv.id]?.trim()}><UiIcon name="arrow"/></button></form></>}
    </> : listState !== "ready" ? null : conversations.length === 0 ? <div className={styles.empty}><span className={styles.emptyIcon}><UiIcon name="chat" width="30" height="30"/></span><h2>Inga samtal ännu</h2><p>{isCompany ? "Chatten öppnas när du och en kandidat båda har visat intresse." : "Chatten öppnas när du och ett företag båda har visat intresse."}</p><div className={styles.emptyActions}>{emptyNextStep}</div></div> : <div className={styles.empty}><span className={styles.emptyIcon}><UiIcon name="chat" width="30" height="30"/></span><h2>Välj ett samtal</h2><p>Öppna ett samtal i inkorgen för att läsa eller skriva ett meddelande.</p></div>}</section></div>
  </main>;
}

export default function ChatsPage() {return <Suspense fallback={<main className={styles.page}><p role="status">Hämtar meddelanden…</p></main>}><ChatsPageContent/></Suspense>;}
