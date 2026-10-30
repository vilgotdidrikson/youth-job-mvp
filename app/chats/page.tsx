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
import { getMessages, getMyConversationContacts, getMyConversations, sendMessage, subscribeToConversationMessages } from "@/lib/chat";
import { chatRequestKey, isRequestedConversation } from "@/lib/chat-navigation";
import { getMyMatches } from "@/lib/matching";
import { RecruitmentPanel } from "@/components/recruitment-panel";
import { employmentStatusLabel } from "@/lib/recruitment-types";
import type { ChatMessage, ConversationSummary } from "@/lib/types";
import { ReportDialog } from "@/components/report-dialog";
import { ChatVideoComposer, VideoMessage } from "@/components/chat-video";
import { blockConversationUser } from "@/lib/moderation";
import { markMatchNotificationsRead } from "@/lib/notifications";
import { UiIcon } from "@/components/ui-icon";
import styles from "./chat.module.css";
import { chatIsReadOnly } from "@/lib/application-withdrawal";
import { subscribeVisibleRefresh } from "@/lib/visible-refresh";

interface ConvDisplay { conv: ConversationSummary; otherName: string; jobTitle?: string; status: string; matchId?: string }
const statusLabels: Record<string, string> = { matched: "Matchad", in_contact: "Kontakt pågår", interview: "Intervju", hired: employmentStatusLabel(), rejected: "Avslutad", cancelled: "Avslutad" };
const initials = (name: string) => name.split(" ").filter(Boolean).slice(0,2).map(word => word[0]).join("").toUpperCase();
function messageTime(value: unknown) { const date = new Date(String(value ?? "")); return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("sv-SE", { hour:"2-digit", minute:"2-digit" }).format(date); }
function messageDate(value: unknown) { const date = new Date(String(value ?? "")); return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("sv-SE", {day:"numeric", month:"long"}).format(date); }
function mergeMessages(a: ChatMessage[], b: ChatMessage[]) {
  return [...new Map([...a,...b].map(item => [item.id,item])).values()].sort((x,y) => String(x.created_at ?? "").localeCompare(String(y.created_at ?? "")));
}

function ChatsPageContent() {
  const { user, profile, status, error: sessionError } = useRequireAuth();
  const { cvCompleted, cvLoading } = useCvCompletion(user?.id, profile?.role === "youth");
  const [conversations, setConversations] = useState<ConvDisplay[]>([]), [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<{id:string; items:ChatMessage[]}>({id:"",items:[]});
  const [drafts, setDrafts] = useState<Record<string,string>>({}), [search, setSearch] = useState("");
  const [listState, setListState] = useState<"loading" | "ready" | "error">("loading"), [loadedId, setLoadedId] = useState("");
  const [error, setError] = useState(""), [messageError, setMessageError] = useState(""), [sending, setSending] = useState(false);
  const [historyRetry, setHistoryRetry] = useState(0);
  const retention = useConversationRetention(selectedId, user?.id);
  const [blocking, setBlocking] = useState(false);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null), selectedRef = useRef<string | null>(null), sendLock = useRef(false);
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
  const loadConversations = useCallback(async (showLoading = true) => {
    if (showLoading) setListState("loading");
    try {
      const [convs, contacts, matches] = await Promise.all([getMyConversations(), getMyConversationContacts(), getMyMatches()]);
      const contactMap = new Map(contacts.map(item => [item.conversation_id,item])), matchMap = new Map(matches.map(item => [item.id,item]));
      const display=convs.map(conv => ({conv, otherName:contactMap.get(conv.id)?.other_name || "Kontakt", jobTitle:contactMap.get(conv.id)?.job_title || undefined, status:matchMap.get(conv.match_id ?? "")?.status || "matched", matchId:conv.match_id || undefined}));
      setConversations(display);
      const request={conversationId:requestedConversation,matchId:requestedMatch,jobId:requestedJob};
      const requestKey=chatRequestKey(request);
      const target=display.find(item=>isRequestedConversation(item.conv,request));
      if(target && openedRequest.current!==requestKey) {openedRequest.current=requestKey;selectedRef.current=target.conv.id;setSelectedId(target.conv.id);setLoadedId("");setMessageError("");}
      setListState("ready"); setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Kunde inte läsa dina chattar."); if(showLoading) setListState("error"); }
  }, [requestedJob,requestedConversation,requestedMatch]);
  useEffect(() => { if(user && !cvLoading && (profile?.role !== "youth" || cvCompleted)) void loadConversations(); },[user,profile?.role,cvLoading,cvCompleted,loadConversations]);
  useEffect(() => { if (!user) return; return subscribeVisibleRefresh(() => loadConversations(false)); }, [user,loadConversations]);
  useEffect(() => {
    if(!selectedId) return;
    let active = true;
    const unsubscribe = subscribeToConversationMessages(selectedId,message => {
      if(!active) return;
      setMessages(current => ({id:selectedId, items:mergeMessages(current.id === selectedId ? current.items : [],[message])}));
      void loadConversations(false);
    });
    void getMessages(selectedId).then(items => {
      if(!active) return;
      setMessages(current => ({id:selectedId, items:mergeMessages(items,current.id === selectedId ? current.items : [])})); setLoadedId(selectedId);
    }).catch(reason => { if(active) setMessageError(reason instanceof Error ? reason.message : "Kunde inte läsa meddelanden."); });
    return () => { active = false; unsubscribe(); };
  },[selectedId,loadConversations,historyRetry]);
  useEffect(() => { bottomRef.current?.scrollIntoView({behavior:"instant",block:"nearest"}); },[messages]);
  // An open, visible conversation has been seen: clear its match and message notices and badges.
  const openMatchId = loadedId && loadedId === selectedId ? conversations.find(item => item.conv.id === loadedId)?.matchId : undefined;
  const seenCount = messages.id === loadedId ? messages.items.length : 0;
  useEffect(() => {
    if(!user?.id || !openMatchId) return;
    const userId = user.id, matchId = openMatchId;
    const markSeen = () => { if(document.visibilityState === "visible") void markMatchNotificationsRead(userId,matchId).then(changed => { if(changed) window.dispatchEvent(new Event("mnw-navigation-refresh")); }); };
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
    if(!id || !text || loadedId !== id || retention.writeBlocked || sendLock.current || chatIsReadOnly(conversations.find(item => item.conv.id === id)?.status || "")) return;
    sendLock.current=true; setSending(true); setMessageError("");
    try {
      await sendMessage(id,text);
      try{const key=`mnw-chat-draft:${user?.id}:${id}`;if(sessionStorage.getItem(key)?.trim()===text)sessionStorage.removeItem(key);}catch{/* Storage may be disabled. */}
      setDrafts(current => ({...current,[id]:current[id]?.trim() === text ? "" : current[id]}));

      try {
        const items=await getMessages(id);
        if(selectedRef.current === id) setMessages(current => ({id,items:mergeMessages(items,current.id === id ? current.items : [])}));
      } catch {
        if(selectedRef.current === id) setMessageError("Meddelandet är skickat, men samtalet kunde inte uppdateras. Hämta meddelandena igen för att se den senaste historiken.");
      }
      void loadConversations(false);
    } catch(reason) { if(selectedRef.current === id) setMessageError(reason instanceof Error ? reason.message : "Kunde inte skicka meddelandet. Texten finns kvar."); }
    finally { sendLock.current=false; setSending(false); }
  };
  const selected = conversations.find(item => item.conv.id === selectedId);
  const handleBlock = async () => {
    if(!selected || blocking || !window.confirm(`Blockera ${selected.otherName}? Ingen av er kommer kunna skicka fler meddelanden i chatten.`)) return;
    setBlocking(true); try { await blockConversationUser(selected.conv.id); select(null); setMessages({id:"",items:[]}); await loadConversations(false); } catch(reason) { setError(reason instanceof Error ? reason.message : "Kunde inte blockera användaren."); } finally { setBlocking(false); }
  };
  if(status !== "ready") return <AuthGateMessage status={status} error={sessionError}/>;
  if(cvLoading) return <main className={styles.page}><section className={styles.empty} role="status">Hämtar dina chattar…</section></main>;
  if(profile?.role === "youth" && !cvCompleted) return <main className={`${styles.page} ${styles.cvGate}`}><section className={styles.empty}><span className={styles.emptyIcon}><UiIcon name="chat" width="30" height="30"/></span><h1>Gör klart ditt CV</h1><p>Ett färdigt CV behövs för att skicka din ansökan. När ni båda är intresserade öppnas chatten här.</p><Link className={styles.primary} href="/youth/cv">Fortsätt med CV:t <UiIcon name="arrow"/></Link></section></main>;
  const visible = conversations.filter(item => `${item.otherName} ${item.jobTitle}`.toLocaleLowerCase("sv").includes(search.toLocaleLowerCase("sv")));
  const currentMessages = messages.id === selectedId ? messages.items : [];

  return <main className={`${styles.page} ${selected ? styles.hasConversation : ""}`}>
    <header className={styles.heading}><div className={styles.headingRow}><div className={styles.headingTitle}><Link href={profile?.role==="youth" ? "/applications" : "/company?view=kandidater"} className={styles.back}><UiIcon name="arrow"/>Tillbaka</Link><h1>Meddelanden</h1></div><NotificationLink/></div></header>
    <div className={styles.workspace}><aside className={styles.inbox} aria-label="Inkorg"><div className={styles.inboxHeader}><h2>Meddelanden <span>{conversations.length}</span></h2><label className={styles.search}><span className="sr-only">Sök bland chattar</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Sök namn eller jobb"/></label></div>
      {listState === "loading" ? <p className={styles.listNote} role="status">Hämtar matchningar…</p> : listState === "error" ? <div className={styles.listNote}><p role="alert">{error}</p><button className={styles.secondary} onClick={() => void loadConversations()}>Försök igen</button></div> : visible.length === 0 ? <div className={styles.listNote}><UiIcon name="chat"/><h3>{search ? "Ingen chatt hittades" : "Dina matchningar landar här"}</h3><p>{search ? "Prova ett annat namn eller jobb." : "När båda visar intresse kan ni börja prata."}</p>{!search && profile?.role === "youth" && <Link href="/swipe" className={styles.secondary}>Upptäck jobb</Link>}</div> : <div className={styles.contacts}>{visible.map(item => <button key={item.conv.id} className={`${styles.contact} ${selectedId === item.conv.id ? styles.contactActive : ""}`} type="button" aria-pressed={selectedId === item.conv.id} onClick={() => select(item.conv.id)}><span className={styles.avatar}>{initials(item.otherName)}</span><span className={styles.contactText}><strong>{item.otherName}</strong><span>{item.jobTitle || "Din matchning"}</span><small>{statusLabels[item.status] || item.status}</small></span><UiIcon name="arrow" width="16"/></button>)}</div>}
    </aside><section className={styles.conversation} aria-label={selected ? `Samtal med ${selected.otherName}` : "Konversation"}>{selected ? <>
      <header className={styles.conversationHeader}><button className={styles.mobileBack} type="button" aria-label="Tillbaka till inkorgen" onClick={() => select(null)}><UiIcon name="arrow"/></button><span className={styles.avatar}>{initials(selected.otherName)}</span><div><h2>{selected.otherName}</h2><p>{selected.jobTitle || "Din matchning"}</p></div><span className={styles.matchStatus}>{statusLabels[selected.status] || selected.status}</span><details className={styles.options}><summary aria-label="Alternativ för chatten">•••</summary><div>{selected.conv.job_id && <Link className={styles.jobLink} href={`/jobb/${selected.conv.job_id}`}>Visa jobbannons</Link>}<ReportDialog targetType="conversation" targetId={selected.conv.id} label="Anmäl chatt"/><button type="button" disabled={blocking} onClick={() => void handleBlock()}>{blocking ? "Blockerar…" : "Blockera kontakt"}</button></div></details></header>

      {selected.matchId && <details className={styles.nextSteps} key={selected.matchId}><summary>Jobbet och nästa steg</summary><RecruitmentPanel compact matchId={selected.matchId} company={profile?.role === "company"} onChanged={() => void loadConversations(false)} /></details>}
      {error && listState !== "error" && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.messages} aria-label="Meddelanden">{retention.value?.expired ? <p className={styles.messageNote} role="status">{retention.value.purged_at ? "Chattens meddelanden har raderats." : "Chattens meddelanden är inte längre tillgängliga."}</p> : loadedId !== selectedId ? <p className={styles.messageNote} role="status">{messageError ? "Meddelandena kunde inte hämtas." : "Hämtar meddelanden…"}</p> : currentMessages.length === 0 ? <div className={styles.welcome}><UiIcon name="discover"/><h3>Ni har matchat!</h3><p>{profile?.role === "company" ? "Presentera jobbet och ta nästa steg tillsammans." : "Säg hej och berätta lite om dig själv."}</p></div> : currentMessages.map((message,index) => <div className={styles.messageGroup} key={message.id}>{(index === 0 || messageDate(currentMessages[index - 1].created_at) !== messageDate(message.created_at)) && <p className={styles.date}>{messageDate(message.created_at)}</p>}<div className={`${styles.bubble} ${message.sender_user_id === user?.id ? styles.mine : ""}`}>{!message.video_kind&&<p>{message.message_text}</p>}{message.video_kind&&<VideoMessage message={message} own={message.sender_user_id===user?.id}/>}<time dateTime={String(message.created_at ?? "")}>{messageTime(message.created_at)}</time></div></div>)}<div ref={bottomRef}/></div>

      {messageError && <div className={styles.error}><p role="alert">{messageError}</p><button type="button" className={styles.secondary} disabled={sending} onClick={retryMessages}>Hämta meddelanden igen</button></div>}

      <ConversationRetentionNotice value={retention.value} state={retention.state} retry={retention.retry}/>
      {chatIsReadOnly(selected.status) && !retention.value?.expired ? <p className={styles.messageNote} role="status">Rekryteringen är avslutad. Chatthistoriken finns kvar att läsa, men ni kan inte skicka fler meddelanden.</p> : retention.writeBlocked ? null : <>
      {user&&profile?.role==='youth'&&loadedId===selectedId&&<ChatVideoComposer key={selected.conv.id} conversationId={selected.conv.id} userId={user.id} onSent={()=>{retryMessages();void loadConversations(false);}}/>}
      <form className={styles.composer} onSubmit={handleSend}><label><span className="sr-only">Meddelande till {selected.otherName}</span><textarea ref={composerRef} rows={1} value={drafts[selected.conv.id] || ""} onChange={event => {const input=event.currentTarget;input.style.height="auto";input.style.height=`${Math.min(120,input.scrollHeight)}px`;const value=input.value;try{sessionStorage.setItem(`mnw-chat-draft:${user?.id}:${selected.conv.id}`,value);}catch{/* Storage may be disabled. */}setDrafts(current => ({...current,[selected.conv.id]:value}));}} onKeyDown={event=>{if(event.key==="Enter"&&!event.shiftKey&&!event.nativeEvent.isComposing&&window.matchMedia("(pointer:fine)").matches){event.preventDefault();event.currentTarget.form?.requestSubmit();}}} placeholder="Skriv ett meddelande…" disabled={sending || loadedId !== selectedId}/></label><button type="submit" aria-label={sending ? "Skickar meddelande" : "Skicka meddelande"} disabled={sending || loadedId !== selectedId || !drafts[selected.conv.id]?.trim()}><UiIcon name="arrow"/></button></form></>}
    </> : <div className={styles.empty}><span className={styles.emptyIcon}><UiIcon name="chat" width="30" height="30"/></span><h2>Ett samtal kan bli nästa steg</h2><p>Välj en matchning i inkorgen för att läsa eller skriva ett meddelande.</p></div>}</section></div>
  </main>;
}

export default function ChatsPage() {return <Suspense fallback={<main className={styles.page}><p role="status">Hämtar meddelanden…</p></main>}><ChatsPageContent/></Suspense>;}
