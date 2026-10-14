"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { useRecruitmentProfile } from "@/hooks/use-recruitment-profile";
import { useCvCompletion } from "@/hooks/use-cv-completion";
import { getProfileVideo } from "@/lib/video-client";
import { AuthGateMessage } from "./auth-gate-message";
import { completedProfileSections } from "@/lib/recruitment-profile";
import { PROFILE_JOURNEY, isProfileJourneyStep, profileStepUrl, resumeProfileStep, type ProfileJourneyStep } from "@/lib/profile-journey";
import { ProfileJourneyHeader, ProfileStepComplete } from "./profile-journey";
import { UiIcon } from "./ui-icon";
import styles from "./recruitment-profile.module.css";

export function ProfileBuilder() {
  const {user,profile,status,error}=useRequireAuth();
  const data=useRecruitmentProfile(profile?.role==='youth'?user?.id:undefined);
  const {cvCompleted,cvLoading}=useCvCompletion(user?.id,profile?.role==='youth');
  const [video,setVideo]=useState<{owner:string;exists:boolean;error:boolean;resume:ProfileJourneyStep|null}|null>(null);
  const [retry,setRetry]=useState(0),query=useSearchParams();
  useEffect(()=>{if(!user||profile?.role!=='youth')return;let active=true;let resume:ProfileJourneyStep|null=null;try{const value=localStorage.getItem(`mnw-profile-resume:${user.id}`);if(isProfileJourneyStep(value))resume=value;}catch{}void getProfileVideo(user.id).then(value=>{if(active)setVideo({owner:user.id,exists:!!value,error:false,resume});}).catch(()=>{if(active)setVideo({owner:user.id,exists:false,error:true,resume});});return()=>{active=false;};},[user,profile?.role,retry]);
  if(status!=='ready')return <AuthGateMessage status={status} error={error}/>;
  if(profile?.role!=='youth')return <main className={styles.page}><Link href="/profile">Till din profil</Link></main>;
  const after=query.get('after');
  if(isProfileJourneyStep(after))return <main className={styles.page}><ProfileJourneyHeader step={after}/><ProfileStepComplete step={after} skipped={query.get('skipped')==='1'}/></main>;
  const loading=data.loading||cvLoading||video?.owner!==user?.id;
  const failure=data.error||video?.error;
  const saved=[...completedProfileSections(data.profile),...(cvCompleted?['cv']:[]),...(video?.exists?['video']:[])];
  const next=video?.resume??resumeProfileStep(saved);
  return <main className={styles.page}><header className={styles.heading}><p>Din profil, i din takt</p><h1>Vill du bygga din jobbprofil nu?</h1><p>Vi börjar med CV, fortsätter med en frivillig video och tar sedan en liten del i taget. Du kan pausa efter varje steg.</p></header>
    {loading?<p role="status">Hämtar sparade uppgifter…</p>:failure?<section className={styles.form}><p role="alert">Kunde inte läsa dina sparade profildelar.</p><button type="button" className="secondary-btn" onClick={()=>{setRetry(n=>n+1);void data.reload();}}>Försök igen</button></section>:<>
      <section className={styles.form}><h2>{saved.length?'Fortsätt där du är':'Sex steg. Du bestämmer takten.'}</h2><p>{saved.length?`${saved.length} av ${PROFILE_JOURNEY.length} delar har sparade uppgifter. Valfria delar behöver inte fyllas i.`:'CV behövs för att skicka ansökningar. Video och övriga uppgifter är valfria.'}</p><div className={styles.journeyList}>{PROFILE_JOURNEY.map((part,index)=><div key={part.key}><span>{saved.includes(part.key)?<UiIcon name="check" width="16"/>:index+1}</span><div><strong>{part.title}</strong><small>{part.description}</small></div><em>{saved.includes(part.key)?'Uppgifter finns':part.optional?'Valfritt':'För ansökningar'}</em></div>)}</div><footer><Link className="secondary-btn" href="/swipe">Bygg senare</Link><Link className="cta-btn" href={profileStepUrl(next)}>{saved.length?'Fortsätt bygga profil':'Bygg profil'}<UiIcon name="arrow" width="18"/></Link></footer></section>
    </>}
  </main>;
}
