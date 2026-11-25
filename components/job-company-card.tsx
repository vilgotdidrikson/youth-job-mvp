"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import { companyFacts, getJobCompanyProfile, type PublicCompanyProfile } from "@/lib/company-public-profile";
import { ModalDialog } from "./modal-dialog";
import { UiIcon } from "./ui-icon";
import styles from "./job-company-card.module.css";

function Logo({ profile, size }: { profile: PublicCompanyProfile; size: number }) {
  if (profile.logoUrl) return <Image src={profile.logoUrl} alt="" width={size} height={size} unoptimized className={styles.logo} />;
  return <span className={styles.logo} style={{ width: size, height: size }} aria-hidden="true">{(profile.companyName || "?").charAt(0).toLocaleUpperCase("sv-SE")}</span>;
}

/** The employer behind a listing (N04). Opens a readable profile; closing it returns to the job. */
export function JobCompanyCard({ jobId, fallbackName }: { jobId: string; fallbackName: string }) {
  const [profile, setProfile] = useState<PublicCompanyProfile | null>(null);
  const [failed, setFailed] = useState(false), [open, setOpen] = useState(false);
  useEffect(() => {
    let active = true;
    void getJobCompanyProfile(jobId).then(result => { if (active) setProfile(result); }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [jobId]);

  // Without the profile the listing still names the employer; no error is needed for an optional extra.
  if (!profile) return failed && fallbackName ? <section className={styles.card} aria-label="Arbetsgivaren"><div className={styles.head}><span className={styles.logo} aria-hidden="true">{fallbackName.charAt(0).toLocaleUpperCase("sv-SE")}</span><div><h2 className={styles.name}>{fallbackName}</h2></div></div></section> : null;

  const name = profile.companyName || fallbackName || "Arbetsgivaren";
  const facts = companyFacts(profile);
  return <section className={styles.card} aria-labelledby="job-company-name">
    <p className={styles.eyebrow}>Arbetsgivaren</p>
    <div className={styles.head}>
      <Logo profile={profile} size={48} />
      <div><h2 id="job-company-name" className={styles.name}>{name}</h2>{facts.length > 0 && <p className={styles.facts}>{facts.join(" · ")}</p>}</div>
    </div>
    {profile.verified && <p className={styles.verified}><UiIcon name="check" width="16" height="16" strokeWidth="2.4" />Verifierat företag</p>}
    <button type="button" className={styles.open} aria-haspopup="dialog" onClick={() => setOpen(true)}>Om företaget<UiIcon name="arrow" width="17" height="17" /></button>
    {open && <ModalDialog labelledBy="company-profile-title" onClose={() => setOpen(false)}>
      <section className={styles.dialog}>
        <div className={styles.head}>
          <Logo profile={profile} size={64} />
          <div><h2 id="company-profile-title" className={styles.dialogTitle}>{name}</h2>{facts.length > 0 && <p className={styles.facts}>{facts.join(" · ")}</p>}</div>
        </div>
        {profile.verified
          ? <p className={styles.verified}><UiIcon name="check" width="16" height="16" strokeWidth="2.4" />Verifierat företag. MatchnWork har kontrollerat organisationsnumret.</p>
          : <p className={styles.unverified}>Företaget är inte verifierat ännu.</p>}
        <div className={styles.section}><h3>Om verksamheten</h3><p>{profile.description || "Företaget har inte skrivit någon beskrivning ännu."}</p></div>
        {(profile.openJobs > 0 || profile.websiteUrl) && <ul className={styles.links}>
          {profile.openJobs > 0 && <li><UiIcon name="briefcase" width="18" height="18" />{profile.openJobs === 1 ? "1 öppet jobb" : `${profile.openJobs} öppna jobb`} hos företaget just nu</li>}
          {profile.websiteUrl && <li><UiIcon name="discover" width="18" height="18" /><a href={profile.websiteUrl} target="_blank" rel="noopener noreferrer">Företagets webbplats<span className="sr-only"> (öppnas i ny flik)</span></a></li>}
        </ul>}
        <p className={styles.note}>Uppgifterna kommer från företaget.</p>
        <button type="button" className={styles.close} autoFocus onClick={() => setOpen(false)}><UiIcon name="chevron-left" width="18" height="18" strokeWidth="2" />Tillbaka till jobbet</button>
      </section>
    </ModalDialog>}
  </section>;
}
