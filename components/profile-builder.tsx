"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { useRecruitmentProfile } from "@/hooks/use-recruitment-profile";
import { useCvCompletion } from "@/hooks/use-cv-completion";
import { AuthGateMessage } from "./auth-gate-message";
import { PROFILE_SECTIONS, completedProfileSections } from "@/lib/recruitment-profile";
import { UiIcon } from "./ui-icon";
import styles from "./recruitment-profile.module.css";
const parts = [{key:"cv",title:"Mitt CV",description:"Skriv med stöd av frågor eller ladda upp ett CV.",prompt:"Behövs för att skicka ansökningar"}, ...PROFILE_SECTIONS.map(part => ({...part,prompt:"Valfritt – kompletterar ditt CV"}))];
export function ProfileBuilder() {
  const { user, profile, status, error } = useRequireAuth();
  const data = useRecruitmentProfile(profile?.role === "youth" ? user?.id : undefined);
  const {cvCompleted,cvLoading}=useCvCompletion(user?.id,profile?.role === "youth");
  const router=useRouter(), query=useSearchParams();
  const [choosing,setChoosing]=useState(query.get("welcome") !== "1");
  const [selected,setSelected]=useState<string[]>([]);
  const key=`mnw-profile-plan:${user?.id}`;
  useEffect(() => {if (!user) return; try { const value=JSON.parse(localStorage.getItem(key) ?? "[]"); if (Array.isArray(value)) queueMicrotask(()=>setSelected(value.filter(item=>parts.some(part=>part.key===item)))); } catch {}},[key,user]);
  const choose=(items:string[])=>{setSelected(items);try{localStorage.setItem(key,JSON.stringify(items));}catch{}};
  if(status !== "ready") return <AuthGateMessage status={status} error={error}/>;
  if(profile?.role !== "youth") return <main className={styles.page}><Link href="/profile">Till din profil</Link></main>;
  const saved=[...completedProfileSections(data.profile),...(cvCompleted ? ["cv"]:[])];
  const remaining=selected.filter(part=>!saved.includes(part));
  const begin=()=>{const part=remaining[0] ?? selected[0]; if(!part)return; router.push(part === "cv" ? "/youth/cv?return=build" : `/profile/develop?section=${part}&return=build`);};
  return <main className={styles.page}><header className={styles.heading}><p>Din profil, i din takt</p><h1>{choosing ? "Vad vill du börja med?" : "Ge företag en bild av dig."}</h1><p>Ett CV behövs för att skicka ansökningar. De andra delarna är valfria. Mer relevant information hjälper företag att förstå vad du kan och kan förbättra dina chanser att hitta rätt jobb.</p></header>{!choosing ? <section className={styles.form}><h2>Du väljer själv hur mycket du gör nu</h2><p>Bygg ditt CV, berätta när du kan jobba och lägg till kunskaper eller egna exempel. Du kan göra en del, flera eller alla – och fortsätta senare från din profil.</p><footer><button className="cta-btn" onClick={()=>setChoosing(true)}>Bygg din profil <UiIcon name="arrow"/></button><Link className="secondary-btn" href="/swipe">Skapa den senare</Link></footer></section> : data.loading || cvLoading ? <p role="status">Hämtar sparade profildelar…</p> : data.error ? <section className={styles.form}><p role="alert">{data.error}</p><footer><button type="button" className="secondary-btn" onClick={() => void data.reload()}>Försök igen</button><Link href="/profile" className="secondary-btn">Tillbaka till min profil</Link></footer></section> : <><p className={styles.note}>{saved.length} av {parts.length} delar har sparade uppgifter. Det betyder inte att varje fält är ifyllt.</p><div className={styles.sectionGrid}>{parts.map(part=><section className={styles.sectionCard} key={part.key}><label><input type="checkbox" checked={selected.includes(part.key)} onChange={()=>choose(selected.includes(part.key)?selected.filter(item=>item !== part.key):[...selected,part.key])}/><strong>{part.title}</strong></label><span>{part.prompt}</span><p>{part.description}</p><p>{saved.includes(part.key) ? "Sparade uppgifter finns" : "Inte tillagt ännu"}</p><Link href={part.key === "cv" ? "/youth/cv?return=build" : `/profile/develop?section=${part.key}&return=build`}>{saved.includes(part.key)?"Visa och ändra":"Börja med den här delen"} →</Link></section>)}</div><section className={styles.form}><footer><button className="secondary-btn" onClick={()=>choose(parts.map(part=>part.key))}>Välj alla delar</button><button className="cta-btn" disabled={!selected.length} onClick={begin}>{remaining.length ? `Börja / fortsätt med ${remaining.length} valda delar` : selected.length ? "Redigera vald del" : "Välj delarna ovan"}</button></footer><p>Du gör en del åt gången. Efter att du sparat kommer du tillbaka hit. Uppgifter i CV:t behöver inte skrivas igen – lägg bara till mer precision där det hjälper.</p><Link className="secondary-btn" href="/swipe">Fortsätt upptäcka jobb</Link></section></>}</main>;
}
