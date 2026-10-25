"use client";
import { preferredJobCategories } from "@/lib/job-categories";
import Link from "next/link";
import { ProfileJourneyHeader, ProfileStepComplete } from "./profile-journey";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { useRecruitmentProfile } from "@/hooks/use-recruitment-profile";
import { AuthGateMessage } from "./auth-gate-message";
import { getSupabaseClient } from "@/lib/supabase";
import { DAYS, PERIODS, PROFILE_SECTIONS, completedProfileSections, validateRecruitmentProfile, type ProfileSection, type RecruitmentProfile } from "@/lib/recruitment-profile";
import { UiIcon } from "./ui-icon";
import styles from "./recruitment-profile.module.css";
import { useCvCompletion } from "@/hooks/use-cv-completion";
import { MAX_LICENCES, MAX_LOCATIONS, MAX_TOOLS, addListItems, addRoles, emptyExample, examplesToSave, isBlankExample } from "@/lib/profile-steps";
import type { ProfileJourneyStep } from "@/lib/profile-journey";
import { StickyActions } from "./profile-steps/controls";
import { PreferencesFields } from "./profile-steps/preferences-step";
import { QualificationsFields } from "./profile-steps/qualifications-step";
import { ExamplesFields, ExamplesTip } from "./profile-steps/examples-step";
import { ProfileStepPage } from "./profile-steps/step-nav";
import stepStyles from "./profile-steps/profile-steps.module.css";

const commaList = (text: string) => [...new Set(text.split(",").map(item => item.trim()).filter(Boolean))];
function Chips({ options, selected, onChange, disabled, groupLabel }: { options: Record<string,string>; selected: string[]; onChange: (items: string[]) => void; disabled?: boolean; groupLabel: string }) {
  return <div className={styles.chips} role="group" aria-label={groupLabel}>{Object.entries(options).map(([key,label]) => <button key={key} type="button" aria-pressed={selected.includes(key)} disabled={disabled} onClick={() => onChange(selected.includes(key) ? selected.filter(item => item !== key) : [...selected,key])}>{label}</button>)}</div>;
}

function SectionForm({ section, profile, version, onSaved, onClose, cvLanguages, onBusyChange, onDirtyChange, journey = false, cvFacts }: { section: ProfileSection; profile: RecruitmentProfile; version: number; onSaved: () => Promise<void>; onClose: () => void; cvLanguages:{language:string;level:string}[]; onBusyChange?:(value:boolean)=>void; onDirtyChange?:(value:boolean)=>void; journey?: boolean; cvFacts?: string }) {
  // Step 5 opens with an empty example card; a blank card is never saved and does not count as a change.
  const [draft, setDraft] = useState(() => section==="examples"&&!profile.examples.length?{...profile,examples:[emptyExample()]}:profile), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [roles, setRoles] = useState(profile.preferences.roles.join(", ")), [locations, setLocations] = useState(profile.preferences.locations.join(", "));
  const [licences, setLicences] = useState(profile.qualifications.licences.join(", ")), [tools, setTools] = useState(profile.qualifications.tools.join(", "));
  const cvNames=new Set(cvLanguages.map(item=>item.language.trim().toLocaleLowerCase("sv-SE")));
  const [extraLanguages,setExtraLanguages]=useState(profile.qualifications.languages.filter(item=>!cvNames.has(item.language.trim().toLocaleLowerCase("sv-SE"))));
  const [pendingRole,setPendingRole]=useState<string|null>(null),[pendingLocation,setPendingLocation]=useState("");
  const [pendingLicence,setPendingLicence]=useState(""),[pendingTool,setPendingTool]=useState("");
  const dirty=JSON.stringify({...draft,examples:draft.examples.filter(example=>!isBlankExample(example))})!==JSON.stringify(profile)||roles!==profile.preferences.roles.join(", ")||locations!==profile.preferences.locations.join(", ")||licences!==profile.qualifications.licences.join(", ")||tools!==profile.qualifications.tools.join(", ")||JSON.stringify(extraLanguages)!==JSON.stringify(profile.qualifications.languages.filter(item=>!cvLanguages.some(cv=>cv.language.trim().toLocaleLowerCase("sv-SE")===item.language.trim().toLocaleLowerCase("sv-SE"))))||Boolean(pendingRole?.trim())||Boolean(pendingLocation.trim())||Boolean(pendingLicence.trim())||Boolean(pendingTool.trim());
  useEffect(()=>{onDirtyChange?.(dirty);},[dirty,onDirtyChange]);
  const descriptor = PROFILE_SECTIONS.find(item => item.key === section)!;
  const availability = (value: Partial<RecruitmentProfile["availability"]>) => setDraft(current => ({ ...current, availability: { ...current.availability, ...value } }));
  const preferences = (value: Partial<RecruitmentProfile["preferences"]>) => setDraft(current => ({ ...current, preferences: { ...current.preferences, ...value } }));
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (busy) return; setError(""); setBusy(true);onBusyChange?.(true);
    try {
      if(section==="qualifications"&&extraLanguages.some(item=>cvNames.has(item.language.trim().toLocaleLowerCase("sv-SE"))))throw new Error("Språk som redan finns i CV:t ändras i CV-redigeringen.");
      const examples=examplesToSave(draft.examples);
      if(section==="examples"&&examples.error)throw new Error(examples.error);
      // Text still in "Eget jobb", "Lägg till ort" or a tag field is saved too; an empty language row is dropped.
      const roleList=pendingRole?.trim()?addRoles(commaList(roles),pendingRole):commaList(roles), locationList=addListItems(commaList(locations),pendingLocation,MAX_LOCATIONS);
      const languages=extraLanguages.filter(item=>item.language.trim()||item.level.trim());
      const clean = validateRecruitmentProfile({ ...draft, examples: examples.examples, preferences: { ...draft.preferences, roles: roleList, categoryIds: preferredJobCategories(roleList), locations: locationList }, qualifications: { ...draft.qualifications, licences: addListItems(commaList(licences),pendingLicence,MAX_LICENCES), tools: addListItems(commaList(tools),pendingTool,MAX_TOOLS),languages:section==="qualifications"?[...cvLanguages.filter(item=>item.level),...languages]:draft.qualifications.languages } });
      const { error: failure } = await getSupabaseClient().rpc("save_my_recruitment_profile", { p_section: section, p_value: clean[section], p_expected_version: version });
      if (failure) throw new Error(failure.code === "40001" ? "Profilen har ändrats i en annan vy. Kopiera dina ändringar och gå tillbaka för att läsa in den senaste profilen." : "Uppgifterna kunde inte sparas. Dina ändringar finns kvar här; försök igen.");
      onDirtyChange?.(false);await onSaved();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Kontrollera uppgifterna."); }
    finally { setBusy(false);onBusyChange?.(false); }
  }
  const leave=()=>{if(dirty&&!window.confirm(journey?"Hoppa över utan att spara dina ändringar?":"Avbryt utan att spara dina ändringar?"))return;onDirtyChange?.(false);onClose();};
  if(section==="preferences")return <form className={stepStyles.stepForm} onSubmit={event => void save(event)}><fieldset className={stepStyles.fieldset} disabled={busy}><legend className="sr-only">Jobb du söker</legend>
    <PreferencesFields value={{roles:commaList(roles),locations:commaList(locations),travelMinutes:draft.preferences.travelMinutes,motivation:draft.preferences.motivation}} onChange={next=>{if(next.roles)setRoles(next.roles.join(", "));if(next.locations)setLocations(next.locations.join(", "));if(next.travelMinutes!==undefined)preferences({travelMinutes:next.travelMinutes});if(next.motivation!==undefined)preferences({motivation:next.motivation});}} pendingRole={pendingRole} onPendingRole={setPendingRole} pendingLocation={pendingLocation} onPendingLocation={setPendingLocation} savedTravel={profile.preferences.travelMinutes} cvFacts={cvFacts} heading={journey?"h1":"h2"} disabled={busy}/>
  </fieldset>{error && <p role="alert" className={stepStyles.error}>{error}</p>}<StickyActions fixed={journey} secondaryLabel={journey?"Hoppa över":"Avbryt"} onSecondary={leave} primaryLabel={busy?"Sparar…":journey?"Spara och fortsätt":"Spara den här delen"} busy={busy} note={journey?"Används bara i dina ansökningar.":undefined}/></form>;
  const actions=(primary:string)=><StickyActions fixed={journey} secondaryLabel={journey?"Hoppa över":"Avbryt"} onSecondary={leave} primaryLabel={busy?"Sparar…":journey?primary:"Spara den här delen"} busy={busy} note={journey?"Används bara i dina ansökningar.":undefined}/>;
  if(section==="qualifications")return <form className={stepStyles.stepForm} onSubmit={event => void save(event)}><fieldset className={stepStyles.fieldset} disabled={busy}><legend className="sr-only">Kunskaper och språk</legend>
    <QualificationsFields value={{licences:commaList(licences),tools:commaList(tools),extraLanguages}} onChange={next=>{if(next.licences)setLicences(next.licences.join(", "));if(next.tools)setTools(next.tools.join(", "));if(next.extraLanguages)setExtraLanguages(next.extraLanguages);}} pendingLicence={pendingLicence} onPendingLicence={setPendingLicence} pendingTool={pendingTool} onPendingTool={setPendingTool} cvLanguages={cvLanguages} heading={journey?"h1":"h2"} disabled={busy}/>
  </fieldset>{error && <p role="alert" className={stepStyles.error}>{error}</p>}{actions("Spara och fortsätt")}</form>;
  if(section==="examples")return <form className={stepStyles.stepForm} onSubmit={event => void save(event)}><fieldset className={stepStyles.fieldset} disabled={busy}><legend className="sr-only">Egna exempel</legend>
    <ExamplesFields examples={draft.examples} savedCount={profile.examples.length} onChange={examples=>setDraft(current=>({...current,examples}))} heading={journey?"h1":"h2"} showTip={journey?"mobile":"always"} disabled={busy}/>
  </fieldset>{error && <p role="alert" className={stepStyles.error}>{error}</p>}{actions("Spara och bli klar")}</form>;
  return <form className={styles.form} onSubmit={event => void save(event)}><header><p>En liten del i taget</p><h2>{descriptor.title}</h2><p>{descriptor.prompt}</p></header><fieldset disabled={busy}>
    {section === "availability" && <><legend className="sr-only">När du kan jobba</legend><div><h3>Vilka dagar kan du vanligtvis jobba?</h3><p>Välj de dagar som passar. Du kan ändra senare.</p><Chips groupLabel="Dagar du kan jobba" options={DAYS} selected={draft.availability.days} onChange={days => availability({days})}/></div><div><h3>Vilka tider passar?</h3><Chips groupLabel="Tider som passar" options={PERIODS} selected={draft.availability.periods} onChange={periods => availability({periods})}/></div><div className={styles.columns}><label>Tidigaste startdatum <span>(valfritt)</span><input type="date" value={draft.availability.startDate} onChange={event => availability({startDate:event.target.value})}/></label><label>Ungefärliga timmar per vecka <span>(valfritt)</span><input type="number" min="0" max="60" value={draft.availability.hours} onChange={event => availability({hours:event.target.value})}/></label></div><label>Egna tider eller annat att förklara<textarea rows={3} maxLength={1000} value={draft.availability.notes ?? ""} onChange={event => availability({notes:event.target.value})} placeholder="Till exempel efter skolan från 16.30 eller varierande schema"/></label></>}
  </fieldset>{error && <p role="alert" className={styles.error}>{error}</p>}<footer><button type="button" className="secondary-btn" disabled={busy} onClick={()=>{onDirtyChange?.(false);onClose();}}>Tillbaka utan att spara</button><button type="submit" className="cta-btn" disabled={busy}>{busy ? "Sparar…" : "Spara den här delen"}</button></footer><p className={styles.note}>Uppgifterna används i dina ansökningar. Du kan lämna fält tomma, ändra eller ta bort det du har skrivit.</p></form>;
}

export function RecruitmentProfileEditor({embedded=false,onBusyChange,onDirtyChange}:{embedded?:boolean;onBusyChange?:(value:boolean)=>void;onDirtyChange?:(value:boolean)=>void}={}) {
  const { user, profile: account, status, error: sessionError } = useRequireAuth();
  const state = useRecruitmentProfile(account?.role === "youth" ? user?.id : undefined);
  const query = useSearchParams();
  const router = useRouter();
  const inJourney=!embedded&&query.get("return")==="build";
  const Container=embedded?"section":"main";
  const [completed,setCompleted]=useState<ProfileSection|null>(null);
  const requested = PROFILE_SECTIONS.find(item => item.key === query.get("section"))?.key ?? null;
  const [selected, setSelected] = useState<ProfileSection | null>(embedded?null:requested), [message, setMessage] = useState("");
  const {cvCompleted}=useCvCompletion(user?.id,account?.role==="youth");
  // "Ja, fortsätt" links to the next section on this same page, so the view follows the URL instead of keeping the previous step.
  useEffect(()=>{if(!embedded){setSelected(requested);setCompleted(null);}},[requested,embedded]);
  if (status !== "ready") return <AuthGateMessage status={status} error={sessionError}/>;
  if (account?.role !== "youth") return <main className={styles.page}><h1>Det här är ungdomens profil</h1><Link href="/profile">Till din profil</Link></main>;
  const complete = completedProfileSections(state.profile);
  const sectionForm=selected&&<SectionForm key={`${selected}:${state.version}`} section={selected} profile={state.profile} version={state.version} cvLanguages={state.cvLanguages} onBusyChange={onBusyChange} onDirtyChange={onDirtyChange} journey={inJourney} cvFacts={inJourney?state.cvFacts||undefined:undefined} onClose={() => {if(inJourney) {router.push("/profile/build");return;}setSelected(null);void state.reload();}} onSaved={async () => {await state.reload();if(inJourney) {setCompleted(selected);return;}setMessage("Uppgifterna är sparade. Du kan fortsätta med nästa del när det passar dig.");}}/>;
  // Every journey step after the CV uses the step menu; the forms move to the new design one delivery at a time (docs/profilbygget/SPEC.md).
  const done=[...(cvCompleted?["cv" as const]:[]),...complete] as ProfileJourneyStep[];
  if(inJourney&&completed)return <ProfileStepPage step={completed} done={done}><ProfileStepComplete step={completed}/></ProfileStepPage>;
  if(inJourney&&selected)return <ProfileStepPage step={selected} done={done} cvFacts={state.cvFacts||undefined} tip={selected==="examples"?<ExamplesTip/>:undefined}>{state.loading ? <p role="status">Hämtar din profil…</p> : state.error ? <section className={stepStyles.card}><p role="alert">{state.error}</p><button className="secondary-btn" onClick={() => void state.reload()}>Försök igen</button></section> : sectionForm}</ProfileStepPage>;
  return <Container className={embedded?styles.embedded:styles.page}>{inJourney&&selected&&<ProfileJourneyHeader step={selected}/>}<Link href={embedded?"/profile?tab=work":"/profile/build"} className={styles.back} hidden={embedded}>← Till profilbygget</Link><header hidden={embedded||inJourney} className={styles.heading}><p>Din profil, i din takt</p><h1>Visa mer av vad du kan.</h1><p>Vad du söker, när du kan jobba och kompletterande kunskaper. En del i taget, helt frivilligt.</p></header>{state.cvFacts && <details className={styles.candidate}><summary>Uppgifter som redan finns i ditt CV</summary><p>{state.cvFacts}</p><p>Du behöver inte skriva om dem. Använd profildelarna för att utveckla eller precisera.</p></details>}{message&&selected&&<p role="status" className={styles.success}>{message}</p>}{state.loading ? <p role="status">Hämtar din profil…</p> : state.error ? <section className={styles.form}><p role="alert">{state.error}</p><button className="secondary-btn" onClick={() => void state.reload()}>Försök igen</button></section> : selected ? sectionForm : <>{message && <p role="status" className={styles.success}>{message}</p>}<div className={styles.sectionGrid}>{PROFILE_SECTIONS.map(section => <button key={section.key} type="button" className={styles.sectionCard} onClick={() => {setSelected(section.key);setMessage("");}}><span><UiIcon name={complete.includes(section.key) ? "check" : "edit"}/>{complete.includes(section.key) ? "Uppgifter finns" : "Valfritt"}</span><h2>{section.title}</h2><p>{section.description}</p><strong>{complete.includes(section.key) ? "Visa och ändra" : "Lägg till"} →</strong></button>)}</div><p className={styles.note}>Företag som får din ansökan kan se dina sparade uppgifter och exempel. Profilen är ingen offentlig katalog.</p><Link hidden={embedded} className="secondary-btn" href="/swipe">Fortsätt upptäcka jobb</Link></>}</Container>;
}
