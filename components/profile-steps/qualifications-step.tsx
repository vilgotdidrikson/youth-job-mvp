"use client";
import Link from "next/link";
import { LANGUAGE_LEVELS } from "@/lib/recruitment-profile";
import { LICENCE_SUGGESTIONS, MAX_LANGUAGES, MAX_LICENCES, MAX_TOOLS, TOOL_SUGGESTIONS } from "@/lib/profile-steps";
import { ChipGroup, TagInput } from "./controls";
import { UiIcon } from "../ui-icon";
import styles from "./profile-steps.module.css";

type Language = { language: string; level: string };
const CV_EDIT_HREF = "/youth/cv/create?edit=1";

export interface QualificationsValue { licences: string[]; tools: string[]; extraLanguages: Language[] }

/** Step 4 "Kunskaper". Languages from the CV are read-only here and edited in the CV. */
export function QualificationsFields({ value, onChange, pendingLicence, onPendingLicence, pendingTool, onPendingTool, cvLanguages, heading, disabled }: {
  value: QualificationsValue; onChange: (value: Partial<QualificationsValue>) => void;
  pendingLicence: string; onPendingLicence: (value: string) => void;
  pendingTool: string; onPendingTool: (value: string) => void;
  cvLanguages: Language[]; heading: "h1" | "h2"; disabled?: boolean;
}) {
  const Heading = heading;
  const languages = value.extraLanguages;
  const canAddLanguage = languages.length + cvLanguages.filter(item => item.level).length < MAX_LANGUAGES;
  const updateLanguage = (index: number, next: Partial<Language>) => onChange({ extraLanguages: languages.map((item, i) => i === index ? { ...item, ...next } : item) });

  return <>
    <div className={styles.title}><Heading>Vad kan du?</Heading><p>Lägg till det du faktiskt kan. Det är okej att fortfarande lära sig.</p></div>

    <div className={styles.pair}>
      <section className={styles.card} aria-labelledby="pb-licences-label">
        <div className={styles.cardHead}><label id="pb-licences-label" className={styles.cardTitle} htmlFor="pb-licences">Körkort och behörigheter</label><span className={styles.count}>{value.licences.length} av {MAX_LICENCES}</span></div>
        <TagInput id="pb-licences" tags={value.licences} onChange={licences => onChange({ licences })} pending={pendingLicence} onPendingChange={onPendingLicence} max={MAX_LICENCES} placeholder="Skriv eller välj" suggestions={LICENCE_SUGGESTIONS} disabled={disabled} />
      </section>
      <section className={styles.card} aria-labelledby="pb-tools-label">
        <div className={styles.cardHead}><label id="pb-tools-label" className={styles.cardTitle} htmlFor="pb-tools">Verktyg och kunskaper</label><span className={styles.count}>{value.tools.length} av {MAX_TOOLS}</span></div>
        <TagInput id="pb-tools" tags={value.tools} onChange={tools => onChange({ tools })} pending={pendingTool} onPendingChange={onPendingTool} max={MAX_TOOLS} placeholder="Skriv eller välj" suggestions={TOOL_SUGGESTIONS} disabled={disabled} />
        <span className={styles.help}>Ta bara med sådant du har använt på riktigt.</span>
      </section>
    </div>

    <section className={`${styles.card} ${cvLanguages.length ? styles.languagesWithCv : ""}`} aria-labelledby="pb-languages-title">
      <h2 id="pb-languages-title" className={`${styles.cardTitle} ${cvLanguages.length ? styles.mobileOnly : ""}`}>Språk</h2>
      {cvLanguages.length > 0 && <div className={styles.cvLanguages}>
        <div className={styles.cvLanguagesHead}><span><span className={styles.mobileOnly}>Från ditt CV</span><span className={styles.desktopOnly}>Språk från ditt CV</span></span><Link className={styles.mobileOnly} href={CV_EDIT_HREF}>Ändra i CV:t</Link></div>
        {cvLanguages.map(item => <div key={item.language} className={styles.cvLanguage}><strong>{item.language}</strong><span>{item.level || "Ingen nivå"}</span></div>)}
        <div className={`${styles.cvLanguagesHead} ${styles.desktopOnly}`}><Link href={CV_EDIT_HREF}>Ändra i CV:t</Link></div>
      </div>}
      <div className={styles.languageList}>
        {languages.map((language, index) => {
          const name = language.language.trim() || "språket";
          // A level written by hand before the chips existed stays selectable.
          const levels = [...LANGUAGE_LEVELS, ...(language.level && !LANGUAGE_LEVELS.includes(language.level) ? [language.level] : [])];
          return <div key={index} className={styles.languageRow}>
            <div className={styles.languageRowHead}>
              <label className={styles.fieldLabel} htmlFor={`pb-language-${index}`}>{index === 0 ? "Lägg till ett språk" : "Ett språk till"}</label>
              <button type="button" className={styles.iconButton} aria-label={`Ta bort ${name}`} disabled={disabled} onClick={() => onChange({ extraLanguages: languages.filter((_, i) => i !== index) })}><UiIcon name="close" width="16" height="16" strokeWidth="2.2" /></button>
            </div>
            <input id={`pb-language-${index}`} className={styles.input} maxLength={60} value={language.language} disabled={disabled} placeholder="Till exempel spanska" onChange={event => updateLanguage(index, { language: event.target.value })} />
            <ChipGroup mode="single" label={`Nivå för ${name}`} options={levels.map(level => ({ value: level, label: level, className: styles.small }))} selected={language.level || null} onSelect={level => updateLanguage(index, { level })} disabled={disabled} />
          </div>;
        })}
        {canAddLanguage && <button type="button" className={styles.dashedButton} disabled={disabled} onClick={() => onChange({ extraLanguages: [...languages, { language: "", level: "" }] })}><UiIcon name="plus" width="15" height="15" strokeWidth="2.4" />{languages.length ? "Ett språk till" : "Lägg till ett språk"}</button>}
      </div>
    </section>

    <p className={`${styles.lockNote} ${styles.mobileOnly}`}><UiIcon name="lock" width="16" height="16" strokeWidth="2" />Används bara i dina ansökningar. Du kan lämna fält tomma och ändra när du vill.</p>
  </>;
}
