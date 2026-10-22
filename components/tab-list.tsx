"use client";
import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { tabId, tabIndexForKey, tabPanelId } from "@/lib/tab-keyboard";

export type TabItem<T extends string> = { value: T; label: ReactNode; disabled?: boolean };

/** WAI-ARIA tabs with one tab stop; arrow keys, Home and End move focus and select. Pair with tabPanelProps. */
export function TabList<T extends string>({ id, label, items, value, onChange, className, itemClassName }: { id: string; label: string; items: readonly TabItem<T>[]; value: T; onChange: (value: T) => void; className?: string; itemClassName?: string }) {
  const list = useRef<HTMLDivElement>(null);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = tabIndexForKey(event.key, items.findIndex(item => item.value === value), items.map(item => !item.disabled));
    if (next === null) return;
    event.preventDefault();
    list.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
    if (items[next].value !== value) onChange(items[next].value);
  };
  // Keep the list reachable when the selected value is missing or disabled.
  const tabStop = items.some(item => item.value === value && !item.disabled) ? value : items.find(item => !item.disabled)?.value;
  return <div ref={list} role="tablist" aria-label={label} className={className} onKeyDown={onKeyDown}>{items.map(item => {
    const selected = item.value === value;
    return <button key={item.value} type="button" role="tab" className={itemClassName} id={tabId(id, item.value)} aria-selected={selected} aria-controls={selected ? tabPanelId(id) : undefined} tabIndex={item.value === tabStop ? 0 : -1} disabled={item.disabled} onClick={() => { if (!selected) onChange(item.value); }}>{item.label}</button>;
  })}</div>;
}
