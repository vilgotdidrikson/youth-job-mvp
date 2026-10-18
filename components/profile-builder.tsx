"use client";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { useRecruitmentProfile } from "@/hooks/use-recruitment-profile";
import { useCvCompletion } from "@/hooks/use-cv-completion";
import { AuthGateMessage } from "./auth-gate-message";
import { completedProfileSections } from "@/lib/recruitment-profile";
import { PROFILE_JOURNEY, isProfileJourneyStep, profileStepUrl, resumeProfileStep, restoredProfileStep } from "@/lib/profile-journey";
import { ProfileJourneyHeader, ProfileStepComplete } from "./profile-journey";
import { UiIcon } from "./ui-icon";
import styles from "./recruitment-profile.module.css";

function subscribeResume(listener: () => void) {
  window.addEventListener('storage', listener);
  return () => window.removeEventListener('storage', listener);
}

export function ProfileBuilder() {
  const {user,profile,status,error}=useRequireAuth();
  const data=useRecruitmentProfile(profile?.role==='youth'?user?.id:undefined);
  const {cvCompleted,cvLoading}=useCvCompletion(user?.id,profile?.role==='youth');
  const query=useSearchParams();
  const storedResume=useSyncExternalStore(subscribeResume,()=>{
    if(!user)return null;
    try{return localStorage.getItem(`mnw-profile-resume:${user.id}`);}catch{return null;}
  },()=>null);
  const resume=restoredProfileStep(storedResume);
  if(status!=='ready')return <AuthGateMessage status={status} error={error}/>;
  if(profile?.role!=='youth')return <main className={styles.page}><Link href="/profile">Till din profil</Link></main>;
  const after=query.get('after');
  if(after==='video')return <main className={styles.page}><h1>Fortsätt bygga din profil</h1><p>Profilvideo används inte längre. Nästa del handlar om vilka jobb du söker.</p><Link className="cta-btn" href={profileStepUrl('preferences')}>Fortsätt till vad jag söker</Link></main>;
  if(isProfileJourneyStep(after))return <main className={styles.page}><ProfileJourneyHeader step={after}/><ProfileStepComplete step={after} skipped={query.get('skipped')==='1'}/></main>;
  const loading=data.loading||cvLoading;
  const failure=data.error;
  const saved=[...completedProfileSections(data.profile),...(cvCompleted?['cv']:[])];
  const next=resume??resumeProfileStep(saved);
  return <main className={styles.page}><header className={styles.heading}><p>Din profil, i din takt</p><h1>Vill du bygga din jobbprofil nu?</h1><p>Vi börjar med CV och tar sedan en liten profildel i taget. Du kan pausa efter varje steg.</p></header>
    {loading?<p role="status">Hämtar sparade uppgifter…</p>:failure?<section className={styles.form}><p role="alert">Kunde inte läsa dina sparade profildelar.</p><button type="button" className="secondary-btn" onClick={()=>{void data.reload();}}>Försök igen</button></section>:<>
      <section className={styles.form}><h2>{saved.length?'Fortsätt där du är':'Fem steg. Du bestämmer takten.'}</h2><p>{saved.length?`${saved.length} av ${PROFILE_JOURNEY.length} delar har sparade uppgifter. Valfria delar behöver inte fyllas i.`:'CV behövs för att skicka ansökningar. Övriga uppgifter är valfria.'}</p><div className={styles.journeyList}>{PROFILE_JOURNEY.map((part,index)=><div key={part.key}><span>{saved.includes(part.key)?<UiIcon name="check" width="16"/>:index+1}</span><div><strong>{part.title}</strong><small>{part.description}</small></div><em>{saved.includes(part.key)?'Uppgifter finns':part.optional?'Valfritt':'För ansökningar'}</em></div>)}</div><footer><Link className="secondary-btn" href="/swipe">Bygg senare</Link><Link className="cta-btn" href={profileStepUrl(next)}>{saved.length?'Fortsätt bygga profil':'Bygg profil'}<UiIcon name="arrow" width="18"/></Link></footer></section>
    </>}
  </main>;
}
