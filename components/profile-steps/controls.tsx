"use client";
import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { tabIndexForKey } from "@/lib/tab-keyboard";
import { addListItems, removeListItem } from "@/lib/profile-steps";
import { UiIcon, type IconName } from "../ui-icon";
import styles from "./profile-steps.module.css";

export function FormCard({ title, titleId, count, children, className = "" }: { title?: ReactNode; titleId?: string; count?: string; children: ReactNode; className?: string }) {
  return <section className={`${styles.card} ${className}`} aria-labelledby={title ? titleId : undefined}>
    {title && <div className={styles.cardHead}><h2 id={titleId} className={styles.cardTitle}>{title}</h2>{count && <span className={styles.count}>{count}</span>}</div>}
    {children}
  </section>;
}

export type ChipOption<T extends string> = { value: T; label: ReactNode; className?: string };

/** Multi-select chips use aria-pressed; single choice is a radiogroup with arrow keys. A full multi-select disables the rest. */
export function ChipGroup<T extends string>(props: { label?: string; labelledBy?: string; options: readonly ChipOption<T>[]; disabled?: boolean; children?: ReactNode } & ({ mode: "multi"; selected: readonly T[]; max?: number; onToggle: (value: T) => void } | { mode: "single"; selected: T | null; onSelect: (value: T) => void })) {
  const { label, labelledBy, options, disabled, children } = props;
  const group = useRef<HTMLDivElement>(null);
  if (props.mode === "multi") {
    const full = props.max !== undefined && props.selected.length >= props.max;
    return <div ref={group} className={styles.chips} role="group" aria-label={label} aria-labelledby={labelledBy}>{options.map(option => {
      const on = props.selected.includes(option.value);
      return <button key={option.value} type="button" className={`${styles.chip} ${option.className ?? ""}`} aria-pressed={on} disabled={disabled || (!on && full)} onClick={() => props.onToggle(option.value)}>{on && <UiIcon name="check" width="15" height="15" strokeWidth="2.6" />}<span>{option.label}</span></button>;
    })}{children}</div>;
  }
  const { selected, onSelect } = props;
  const current = options.findIndex(option => option.value === selected);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = tabIndexForKey(event.key === "ArrowDown" ? "ArrowRight" : event.key === "ArrowUp" ? "ArrowLeft" : event.key, current, options.map(() => !disabled));
    if (next === null) return;
    event.preventDefault();
    onSelect(options[next].value);
    group.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
  };
  return <div ref={group} className={styles.chips} role="radiogroup" aria-label={label} aria-labelledby={labelledBy} onKeyDown={onKeyDown}>{options.map((option, index) => {
    const on = option.value === selected;
    return <button key={option.value} type="button" role="radio" className={`${styles.chip} ${option.className ?? ""}`} aria-checked={on} tabIndex={on || (current < 0 && index === 0) ? 0 : -1} disabled={disabled} onClick={() => onSelect(option.value)}>{on && <UiIcon name="check" width="15" height="15" strokeWidth="2.6" />}<span>{option.label}</span></button>;
  })}{children}</div>;
}

/** Tags with remove buttons. Enter or comma adds. Text still being typed is owned by the parent and saved with the form; it is not turned into a tag on blur, which would shift the layout under the next tap. */
export function TagInput({ id, tags, onChange, pending, onPendingChange, max, placeholder, suggestions = [], disabled }: { id: string; tags: readonly string[]; onChange: (tags: string[]) => void; pending: string; onPendingChange: (value: string) => void; max: number; placeholder: string; suggestions?: readonly string[]; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const full = tags.length >= max;
  const commit = (text = pending) => { if (text.trim()) onChange(addListItems(tags, text, max)); onPendingChange(""); };
  const open = suggestions.filter(item => !tags.some(tag => tag.toLocaleLowerCase("sv-SE") === item.toLocaleLowerCase("sv-SE")));
  return <>
    <div className={styles.tagInput} onClick={event => { if (event.target === event.currentTarget) input.current?.focus(); }}>
      {tags.map(tag => <span key={tag} className={styles.tag}>{tag}<button type="button" aria-label={`Ta bort ${tag}`} disabled={disabled} onClick={() => { onChange(removeListItem(tags, tag)); input.current?.focus(); }}><UiIcon name="close" width="14" height="14" strokeWidth="2.4" /></button></span>)}
      <input ref={input} id={id} className={styles.tagField} value={pending} disabled={disabled || full} placeholder={full ? `Högst ${max}` : placeholder} maxLength={80}
        onChange={event => { const value = event.target.value; if (value.includes(",")) commit(value); else onPendingChange(value); }}
        onKeyDown={event => {
          if (event.key === "Enter") { event.preventDefault(); commit(); }
          else if (event.key === "Backspace" && !pending && tags.length) onChange(tags.slice(0, -1));
        }} />
    </div>
    {open.length > 0 && !full && <div className={styles.tagSuggestions}>{open.map(item => <button key={item} type="button" className={`${styles.chip} ${styles.suggestion}`} disabled={disabled} onClick={() => onChange(addListItems(tags, item, max))}>+ {item}</button>)}</div>}
  </>;
}

/** 2–5 options; the chosen one is white on rose. Choosing it again clears an optional value. */
export function SegmentedControl<T extends string>({ labelledBy, options, value, onChange, disabled }: { labelledBy: string; options: readonly { value: T; label: ReactNode }[]; value: T | ""; onChange: (value: T | "") => void; disabled?: boolean }) {
  return <div className={styles.segmented} role="group" aria-labelledby={labelledBy}>{options.map(option => <button key={option.value} type="button" aria-pressed={option.value === value} disabled={disabled} onClick={() => onChange(option.value === value ? "" : option.value)}>{option.label}</button>)}</div>;
}

export function NumberStepper({ label, value, min, max, onChange, disabled }: { label: string; value: number | null; min: number; max: number; onChange: (value: number) => void; disabled?: boolean }) {
  return <div className={styles.stepper} role="group" aria-label={label}>
    <button type="button" aria-label={`Minska ${label.toLocaleLowerCase("sv-SE")}`} disabled={disabled || (value ?? min) <= min} onClick={() => onChange(Math.max(min, (value ?? min) - 1))}>−</button>
    <output aria-live="polite">{value ?? "–"}</output>
    <button type="button" aria-label={`Öka ${label.toLocaleLowerCase("sv-SE")}`} disabled={disabled || (value ?? min - 1) >= max} onClick={() => onChange(value === null ? min : Math.min(max, value + 1))}>+</button>
  </div>;
}

/** Larger choice with an icon. Use inside a radiogroup (role="radio") or as a toggle. */
export function ChoiceTile({ icon, title, description, selected, onSelect, role = "radio", disabled }: { icon: IconName; title: ReactNode; description?: ReactNode; selected: boolean; onSelect: () => void; role?: "radio" | "toggle"; disabled?: boolean }) {
  const state = role === "radio" ? { role: "radio", "aria-checked": selected } : { "aria-pressed": selected };
  return <button type="button" className={styles.tile} {...state} disabled={disabled} onClick={onSelect}><span className={styles.tileIcon}><UiIcon name={icon} /></span><span className={styles.tileText}><strong>{title}</strong>{description && <small>{description}</small>}</span>{selected && <UiIcon name="check" width="18" height="18" strokeWidth="2.6" />}</button>;
}

/** Fixed bottom bar on mobile in the journey; a row at the end of the form on desktop and elsewhere. */
export function StickyActions({ secondaryLabel, onSecondary, primaryLabel, busy, fixed, note }: { secondaryLabel: string; onSecondary: () => void; primaryLabel: string; busy?: boolean; fixed?: boolean; note?: ReactNode }) {
  return <div className={`${styles.actions} ${fixed ? styles.fixed : ""}`}>
    {note && <span className={styles.actionNote}><UiIcon name="lock" width="15" height="15" strokeWidth="2" />{note}</span>}
    <div className={styles.buttons}>
      <button type="button" className={styles.secondary} disabled={busy} onClick={onSecondary}>{secondaryLabel}</button>
      <button type="submit" className={styles.primary} disabled={busy}>{primaryLabel}</button>
    </div>
  </div>;
}
