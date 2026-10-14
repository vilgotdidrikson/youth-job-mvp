"use client";
import Link from "next/link";
import { useSession } from "@/hooks/use-session";
import { PROFILE_JOURNEY, nextProfileStep, profileStepUrl, type ProfileJourneyStep } from "@/lib/profile-journey";
import { UiIcon } from "./ui-icon";
import styles from "./profile-journey.module.css";

export function ProfileJourneyHeader({step}:{step:ProfileJourneyStep}) {
  const {user}=useSession();
  const remember=()=>{if(user)try{localStorage.setItem(`mnw-profile-resume:${user.id}`,step);}catch{/* Optional navigation hint only. */}};
  const index=PROFILE_JOURNEY.findIndex(item=>item.key===step);
  return <section className={styles.progress} aria-label="Profilbyggets steg"><div className={styles.progressTop}><span>Din jobbprofil · Steg {index+1} av {PROFILE_JOURNEY.length}</span><Link onClick={remember} href="/profile?tab=work">Pausa och fortsätt senare</Link></div><ol>{PROFILE_JOURNEY.map((item,i)=><li key={item.key} aria-current={item.key===step?'step':undefined} className={i===index?styles.current:''}><span>{i+1}</span>{item.title}</li>)}</ol></section>;
}
export function ProfileStepComplete({step,skipped=false}:{step:ProfileJourneyStep;skipped?:boolean}) {
  const {user}=useSession();
  const next=nextProfileStep(step),descriptor=PROFILE_JOURNEY.find(item=>item.key===next);
  const remember=()=>{if(user)try{if(next)localStorage.setItem(`mnw-profile-resume:${user.id}`,next);else localStorage.removeItem(`mnw-profile-resume:${user.id}`);}catch{/* Optional navigation hint only. */}};
  return <section className={styles.next} aria-label="Välj nästa profilsteg"><span className={styles.nextIcon}><UiIcon name={skipped?'arrow':'check'}/></span><p className={styles.eyebrow}>{skipped?'Du kan lägga till den här delen senare':'Den här delen är sparad'}</p><h2>{descriptor?`Nästa steg är ${descriptor.title.toLocaleLowerCase('sv-SE')}`:'Du har gått igenom profilens alla steg'}</h2><p>{descriptor?`${descriptor.description}. Vill du fortsätta?`:'Du kan alltid komplettera eller ändra uppgifterna från din jobbprofil.'}</p><div className={styles.buttons}>{next?<Link onClick={remember} className="cta-btn" href={profileStepUrl(next)}>Ja, fortsätt<UiIcon name="arrow" width="18"/></Link>:<Link onClick={remember} className="cta-btn" href="/profile?tab=work">Visa min jobbprofil</Link>}<Link onClick={remember} className="secondary-btn" href="/profile?tab=work">{next?'Nej, jag fortsätter senare':'Till översikten'}</Link></div></section>;
}
