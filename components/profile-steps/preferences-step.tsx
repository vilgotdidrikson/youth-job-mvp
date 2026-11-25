"use client";
import { useRef, useState } from "react";
import type { JobCategoryId } from "@/lib/job-categories";
import { LEARNING_SUGGESTIONS, MAX_LOCATIONS, MAX_MOTIVATION_LENGTH, MAX_ROLES, MAX_TRAVEL_MINUTES, PRIMARY_JOB_CATEGORY_IDS, TRAVEL_OPTIONS, addRoles, appendSuggestion, isStandardTravel, removeListItem, roleChoices, toggleCategoryRole } from "@/lib/profile-steps";
import { ChipGroup, FormCard, SegmentedControl, TagInput } from "./controls";
import { UiIcon } from "../ui-icon";
import styles from "./profile-steps.module.css";

const CUSTOM = "custom:";

export interface PreferencesValue { roles: string[]; locations: string[]; travelMinutes: string; motivation: string }

/** Step 2 "Vad jag söker". Category chips save the category's full label in roles, so preferredJobCategories keeps working. */
export function PreferencesFields({ value, onChange, pendingRole, onPendingRole, pendingLocation, onPendingLocation, savedTravel, cvFacts, heading, disabled }: {
  value: PreferencesValue; onChange: (value: Partial<PreferencesValue>) => void;
  pendingRole: string | null; onPendingRole: (value: string | null) => void;
  pendingLocation: string; onPendingLocation: (value: string) => void;
  savedTravel: string; cvFacts?: string; heading: "h1" | "h2"; disabled?: boolean;
}) {
  const [showAll, setShowAll] = useState(false), [showCv, setShowCv] = useState(false);
  const customInput = useRef<HTMLInputElement>(null);
  const choices = roleChoices(value.roles);
  const full = value.roles.length >= MAX_ROLES;
  const options = [
    ...choices.categories.map(category => ({ value: category.id as string, label: category.shortLabel, className: PRIMARY_JOB_CATEGORY_IDS.includes(category.id) ? "" : styles.collapsible })),
    ...choices.custom.map(role => ({ value: `${CUSTOM}${role}`, label: role })),
  ];
  const selected = [...choices.categories.filter(category => category.selected).map(category => category.id as string), ...choices.custom.map(role => `${CUSTOM}${role}`)];
  const toggle = (option: string) => onChange({ roles: option.startsWith(CUSTOM) ? removeListItem(value.roles, option.slice(CUSTOM.length)) : toggleCategoryRole(value.roles, option as JobCategoryId) });
  const addCustom = () => { if (pendingRole?.trim()) onChange({ roles: addRoles(value.roles, pendingRole) }); onPendingRole(null); };

  // A saved travel time outside 15/30/45/60 keeps a fifth "Annat" option with a number field.
  const savedOther = savedTravel && !isStandardTravel(savedTravel) ? savedTravel : "";
  const [other, setOther] = useState(Boolean(savedOther));
  const travelOptions = savedOther ? [...TRAVEL_OPTIONS, { value: "other", label: "Annat" }] : TRAVEL_OPTIONS;
  const travelValue = other ? "other" : isStandardTravel(value.travelMinutes) ? value.travelMinutes : "";
  const Heading = heading;
  const learning = LEARNING_SUGGESTIONS.filter(item => !value.motivation.toLocaleLowerCase("sv-SE").includes(item.toLocaleLowerCase("sv-SE")));

  return <>
    <div className={styles.title}><Heading>Vad söker du?</Heading><p>Välj det som lockar. Allt går att ändra senare.</p></div>
    {cvFacts && <div className={styles.mobileOnly}>
      <button type="button" className={styles.cvToggle} aria-expanded={showCv} onClick={() => setShowCv(open => !open)}><UiIcon name="file" width="18" height="18" strokeWidth="2" /><span>Uppgifter från ditt CV används redan</span><strong>{showCv ? "Dölj" : "Visa"}</strong></button>
      {showCv && <p className={styles.cvFacts}>{cvFacts}</p>}
    </div>}

    <FormCard title="Jobb du är nyfiken på" titleId="pb-roles-title" count={`${value.roles.length} av ${MAX_ROLES}`} className={showAll ? "" : styles.collapsed}>
      <ChipGroup mode="multi" labelledBy="pb-roles-title" options={options} selected={selected} max={MAX_ROLES} onToggle={toggle} disabled={disabled}>
        {!showAll && <button type="button" className={`${styles.chip} ${styles.more} ${styles.desktopOnly}`} onClick={() => setShowAll(true)}>Visa alla {choices.categories.length}</button>}
        {pendingRole === null && <button type="button" className={`${styles.chip} ${styles.dashed}`} disabled={disabled || full} onClick={() => { onPendingRole(""); requestAnimationFrame(() => customInput.current?.focus()); }}><UiIcon name="plus" width="15" height="15" strokeWidth="2.4" />Eget jobb</button>}
      </ChipGroup>
      {pendingRole !== null && <div className={styles.inlineAdd}>
        <label className="sr-only" htmlFor="pb-custom-role">Eget jobb</label>
        <input ref={customInput} id="pb-custom-role" maxLength={80} value={pendingRole} disabled={disabled} placeholder="Till exempel barista eller fritidsledare" onChange={event => onPendingRole(event.target.value)}
          onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); addCustom(); } else if (event.key === "Escape") { event.preventDefault(); onPendingRole(null); } }} />
        <button type="button" disabled={disabled || !pendingRole.trim() || full} onClick={addCustom}>Lägg till</button>
      </div>}
      {full && <span className={styles.help} role="status">Du har valt {MAX_ROLES}. Ta bort ett jobb för att välja ett annat.</span>}
    </FormCard>

    <section className={styles.card} aria-label="Var vill du jobba?">
      <h2 className={`${styles.cardTitle} ${styles.mobileOnly}`}>Var vill du jobba?</h2>
      <div className={styles.split}>
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="pb-locations"><span className={styles.mobileOnly}>Orter</span><span className={styles.desktopOnly}>Var vill du jobba?</span></label>
          <TagInput id="pb-locations" tags={value.locations} onChange={locations => onChange({ locations })} pending={pendingLocation} onPendingChange={onPendingLocation} max={MAX_LOCATIONS} placeholder="Lägg till ort" disabled={disabled} />
        </div>
        <div className={styles.field}>
          <span className={styles.fieldLabel} id="pb-travel-label"><span className={styles.mobileOnly}>Hur lång resväg är okej?</span><span className={styles.desktopOnly}>Längsta resväg</span></span>
          <SegmentedControl labelledBy="pb-travel-label" options={travelOptions} value={travelValue} disabled={disabled} onChange={next => {
            if (next === "other") { setOther(true); if (!value.travelMinutes || isStandardTravel(value.travelMinutes)) onChange({ travelMinutes: savedOther }); }
            else { setOther(false); onChange({ travelMinutes: next }); }
          }} />
          {other && <label className={styles.otherMinutes}><input type="number" inputMode="numeric" min={0} max={MAX_TRAVEL_MINUTES} value={value.travelMinutes} disabled={disabled} onChange={event => onChange({ travelMinutes: event.target.value.replace(/\D/g, "").slice(0, 3) })} />minuter</label>}
          <span className={styles.help}>Enkel väg. En önskan, inte ett krav.</span>
        </div>
      </div>
    </section>

    <section className={styles.card} aria-labelledby="pb-motivation-label">
      <label id="pb-motivation-label" className={styles.cardTitle} htmlFor="pb-motivation">Vad vill du lära dig eller göra?</label>
      <textarea id="pb-motivation" className={styles.textarea} rows={3} maxLength={MAX_MOTIVATION_LENGTH} value={value.motivation} disabled={disabled} placeholder="Till exempel lära mig kundservice och få mer ansvar" onChange={event => onChange({ motivation: event.target.value })} />
      {learning.length > 0 && <div className={styles.chips}>{learning.map(item => <button key={item} type="button" className={`${styles.chip} ${styles.suggestion}`} disabled={disabled} onClick={() => onChange({ motivation: appendSuggestion(value.motivation, item) })}>+ {item}</button>)}</div>}
    </section>

    <p className={`${styles.lockNote} ${styles.mobileOnly}`}><UiIcon name="lock" width="16" height="16" strokeWidth="2" />Används bara i dina ansökningar. Du kan lämna fält tomma och ändra när du vill.</p>
  </>;
}
