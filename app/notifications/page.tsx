"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {useRequireAuth} from "@/hooks/use-require-auth";
import {AuthGateMessage} from "@/components/auth-gate-message";
import {UiIcon} from "@/components/ui-icon";
import {getSupabaseClient} from "@/lib/supabase";
import {subscribeVisibleRefresh} from "@/lib/visible-refresh";
import styles from "./activity.module.css";

type Notification={id:string;title:string;body:string;href:string|null;read_at:string|null;created_at:string};
function dateLabel(value:string) {const date=new Date(value);return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("sv-SE",{day:"numeric",month:"short"}).format(date);}
export default function NotificationsPage() {
  const {user,profile,status,error:sessionError}=useRequireAuth();
  const [state,setState]=useState<{owner:string;items:Notification[];loading:boolean;error:string}>({owner:"",items:[],loading:true,error:""});
  const [retry,setRetry]=useState(0);
  const userId=user?.id;
  useEffect(()=>{
    if(!userId) return;
    let active=true;
    const refresh=async()=>{
      const {data,error}=await getSupabaseClient().from("notifications").select("*").eq("user_id",userId).order("created_at",{ascending:false}).limit(50);
      if(active) setState({owner:userId,items:(data ?? []) as Notification[],loading:false,error:error ? "Kunde inte läsa notiserna. Försök igen." : ""});
    };
    void refresh().catch(()=>{if(active)setState({owner:userId,items:[],loading:false,error:"Kunde inte läsa notiserna. Försök igen."});});
    const stop=subscribeVisibleRefresh(refresh);
    return ()=>{active=false;stop();};
  },[userId,retry]);
  const read=async(item:Notification)=>{
    if(item.read_at || !userId) return;
    const stamp=new Date().toISOString();
    const {error}=await getSupabaseClient().from("notifications").update({read_at:stamp}).eq("id",item.id).eq("user_id",userId);
    if(!error){setState(current=>({...current,items:current.items.map(entry=>entry.id===item.id ? {...entry,read_at:stamp} : entry)}));window.dispatchEvent(new Event("mnw-navigation-refresh"));}
  };
  if(status!=="ready") return <AuthGateMessage status={status} error={sessionError}/>;
  const current=state.owner===userId ? state : {items:[],loading:true,error:""};
  return <main className={styles.page}>
    <header className={styles.heading}><p className={styles.eyebrow}>Nytt sedan sist</p><h1>Notiser</h1><p>Händelser som tar dig direkt till rätt ansökan eller samtal.</p></header>
    <div className={styles.layout}><section className={styles.content} aria-label="Dina notiser">
      {current.error && <div className={styles.error}><p role="alert">{current.error}</p><button type="button" className={styles.primary} onClick={()=>setRetry(value=>value+1)}>Försök igen</button></div>}
      {current.loading ? <p className={styles.empty} role="status">Hämtar notiser…</p> : !current.error && !current.items.length ? <section className={styles.empty}><span className={styles.emptyIcon}><UiIcon name="bell"/></span><h2>Du är uppdaterad</h2><p>Nya händelser dyker upp här. Dina ansökningar och meddelanden har egna flikar.</p></section> : <div className={styles.cards}>{current.items.map(item=><Link key={item.id} href={item.href || "/notifications"} onClick={()=>void read(item)} className={`${styles.notification} ${item.read_at ? styles.read : ""}`}><span className={styles.notificationIcon}><UiIcon name="bell"/></span><div><div className={styles.notificationTitle}><h2>{item.title}</h2>{!item.read_at && <span aria-label="Oläst" className={styles.dot}/>}</div><p>{item.body}</p><time dateTime={item.created_at}>{dateLabel(item.created_at)}</time></div><UiIcon name="arrow" width="18"/></Link>)}</div>}
    </section><aside className={styles.aside}><section className={styles.shortcuts}><h2>Gå direkt till</h2><Link href="/chats"><span><UiIcon name="chat"/>Meddelanden</span><UiIcon name="arrow" width="17"/></Link><Link href={profile?.role==="company" ? "/company?view=kandidater" : "/applications"}><span><UiIcon name="briefcase"/>{profile?.role==="company" ? "Kandidater" : "Ansökningar"}</span><UiIcon name="arrow" width="17"/></Link></section></aside></div>
  </main>;
}
