"use client";
import { useRef, useState } from "react";
import { STRENGTHS, type RecruitmentProfile } from "@/lib/recruitment-profile";
import { MAX_EXAMPLES, MAX_EXAMPLE_ACTION_LENGTH, MAX_EXAMPLE_CONTEXT_LENGTH, MAX_STRENGTH_LENGTH, emptyExample, isBlankExample, strengthKey, strengthLabel } from "@/lib/profile-steps";
import { ChipGroup } from "./controls";
import { UiIcon } from "../ui-icon";
import styles from "./profile-steps.module.css";

type Example = RecruitmentProfile["examples"][number];
const CUSTOM = "custom:";
const TIP = "Skolprojekt, föreningsliv och ansvar hemma räknas också.";

export function ExamplesTip() {
  return <div className={styles.tip}><UiIcon name="bulb" width="20" height="20" strokeWidth="1.8" /><span>{TIP}</span></div>;
}

function ExampleCard({ example, index, isNew, onChange, onRemove, disabled }: { example: Example; index: number; isNew: boolean; onChange: (example: Example) => void; onRemove: () => void; disabled?: boolean }) {
  const [ownStrength, setOwnStrength] = useState<string | null>(null);
  const ownInput = useRef<HTMLInputElement>(null);
  const custom = example.strength && !(example.strength in STRENGTHS) ? example.strength : "";
  const options = [...Object.entries(STRENGTHS).map(([value, label]) => ({ value, label })), ...(custom ? [{ value: `${CUSTOM}${custom}`, label: custom }] : [])];
  const selected = custom ? `${CUSTOM}${custom}` : example.strength || null;
  const id = `pb-example-${index}`;
  const addOwn = () => { if (ownStrength?.trim()) onChange({ ...example, strength: strengthKey(ownStrength) }); setOwnStrength(null); };

  return <section className={`${styles.card} ${styles.exampleCard}`} aria-labelledby={`${id}-title`}>
    <div className={styles.exampleCardHead}>
      <span id={`${id}-title`} className={styles.kicker}>{isNew ? "Nytt exempel" : "Ändra exempel"}</span>
      <button type="button" className={styles.textButton} disabled={disabled} onClick={onRemove}>Ta bort</button>
    </div>
    <div className={styles.field}>
      <span id={`${id}-strength`} className={styles.exampleLabel}>Vad vill du visa?</span>
      <ChipGroup mode="single" labelledBy={`${id}-strength`} options={options} selected={selected} onSelect={value => onChange({ ...example, strength: value.startsWith(CUSTOM) ? value.slice(CUSTOM.length) : value })} disabled={disabled}>
        {ownStrength === null && <button type="button" className={`${styles.chip} ${styles.dashed}`} disabled={disabled} onClick={() => { setOwnStrength(""); requestAnimationFrame(() => ownInput.current?.focus()); }}><UiIcon name="plus" width="15" height="15" strokeWidth="2.4" />Eget</button>}
      </ChipGroup>
      {ownStrength !== null && <div className={styles.inlineAdd}>
        <label className="sr-only" htmlFor={`${id}-own`}>Egen styrka</label>
        <input ref={ownInput} id={`${id}-own`} maxLength={MAX_STRENGTH_LENGTH} value={ownStrength} disabled={disabled} placeholder="Till exempel tålamod" onChange={event => setOwnStrength(event.target.value)}
          onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); addOwn(); } else if (event.key === "Escape") { event.preventDefault(); setOwnStrength(null); } }} />
        <button type="button" disabled={disabled || !ownStrength.trim()} onClick={addOwn}>Välj</button>
      </div>}
    </div>
    <div className={styles.field}>
      <label className={styles.exampleLabel} htmlFor={`${id}-context`}>Vilken situation var det?</label>
      <input id={`${id}-context`} className={styles.input} maxLength={MAX_EXAMPLE_CONTEXT_LENGTH} value={example.context} disabled={disabled} placeholder="Till exempel läxhjälp för min lillebror" onChange={event => onChange({ ...example, context: event.target.value })} />
    </div>
    <div className={styles.field}>
      <label className={styles.exampleLabel} htmlFor={`${id}-action`}>Vad gjorde du själv?</label>
      <textarea id={`${id}-action`} className={styles.textarea} rows={4} maxLength={MAX_EXAMPLE_ACTION_LENGTH} value={example.action} disabled={disabled} placeholder="Till exempel: jag planerade veckans läxor och förklarade matten på ett nytt sätt när det inte gick" onChange={event => onChange({ ...example, action: event.target.value })} />
      <span className={styles.help}>Beskriv din egen insats, inte bara gruppens.</span>
    </div>
  </section>;
}

/** Step 5 "Egna exempel". Saved examples are compact rows until "Ändra"; new ones open as cards. */
export function ExamplesFields({ examples, savedCount, onChange, heading, showTip, disabled }: { examples: Example[]; savedCount: number; onChange: (examples: Example[]) => void; heading: "h1" | "h2"; showTip: "always" | "mobile"; disabled?: boolean }) {
  const Heading = heading;
  // Kept in step with the list: saved, complete examples start as rows; anything else opens as a card.
  const [meta, setMeta] = useState(() => examples.map((example, index) => ({ open: index >= savedCount || isBlankExample(example), isNew: index >= savedCount })));
  const update = (index: number, example: Example) => onChange(examples.map((item, i) => i === index ? example : item));
  const remove = (index: number) => { onChange(examples.filter((_, i) => i !== index)); setMeta(current => current.filter((_, i) => i !== index)); };
  const add = () => { onChange([...examples, emptyExample()]); setMeta(current => [...current, { open: true, isNew: true }]); };

  return <>
    <div className={styles.title}><Heading>Visa vad du har gjort</Heading><p>Ett litet exempel kan säga mycket. Du behöver inte ha haft ett jobb.</p></div>
    <div className={showTip === "mobile" ? styles.mobileOnly : ""}><ExamplesTip /></div>

    {examples.map((example, index) => meta[index]?.open ?? true
      ? <ExampleCard key={index} example={example} index={index} isNew={meta[index]?.isNew ?? true} onChange={next => update(index, next)} onRemove={() => remove(index)} disabled={disabled} />
      : <div key={index} className={styles.savedRow}>
        <span className={styles.savedIcon} aria-hidden="true"><UiIcon name="check" width="18" height="18" strokeWidth="2.6" /></span>
        <span className={styles.savedText}><span>{strengthLabel(example.strength)}</span><strong>{example.context}</strong></span>
        <button type="button" className={styles.textButton} aria-label={`Ändra exemplet ${example.context}`} disabled={disabled} onClick={() => setMeta(current => current.map((item, i) => i === index ? { ...item, open: true } : item))}>Ändra</button>
      </div>)}

    {examples.length < MAX_EXAMPLES
      ? <button type="button" className={`${styles.dashedButton} ${styles.addExample}`} disabled={disabled} onClick={add}><UiIcon name="plus" width="15" height="15" strokeWidth="2.4" />{examples.length ? "Ett exempel till" : "Lägg till ett exempel"} <span>({examples.length} av {MAX_EXAMPLES})</span></button>
      : <span className={styles.help} role="status">Du har {MAX_EXAMPLES} exempel, det är max.</span>}

    <p className={`${styles.lockNote} ${styles.mobileOnly}`}><UiIcon name="lock" width="16" height="16" strokeWidth="2" />Används bara i dina ansökningar och visas som dina egna uppgifter, inte som verifierade egenskaper.</p>
  </>;
}
