"use client";
import { useState } from "react";
import styles from "./job-practical-fields.module.css";
import { MAX_WEEKLY_HOURS, PERIOD_MODES, START_MODES, WORK_TIMES, practicalErrors, type JobPracticalForm, type PracticalField, type WorkTime } from "@/lib/job-practical";

/** Builder section for N05. Every part is optional; "Ej bestämt" keeps it out of the listing. */
export function JobPracticalFields({ value, onChange, today, showAll, disabled }: { value: JobPracticalForm; onChange: (value: JobPracticalForm) => void; today?: string; showAll?: boolean; disabled?: boolean }) {
  const [touched, setTouched] = useState<Partial<Record<PracticalField, boolean>>>({});
  const errors = practicalErrors(value, today);
  const error = (field: PracticalField) => (showAll || touched[field]) ? errors[field] : undefined;
  const set = (next: Partial<JobPracticalForm>) => onChange({ ...value, ...next });
  const field = (name: PracticalField) => ({ id: `job-practical-${name}`, "aria-invalid": error(name) ? true : undefined, "aria-describedby": error(name) ? `job-practical-${name}-error` : undefined, onBlur: () => setTouched(current => ({ ...current, [name]: true })), disabled });
  const message = (name: PracticalField) => error(name) && <p id={`job-practical-${name}-error`} className="job-builder-field-error" role="alert">{error(name)}</p>;
  const chip = (selected: boolean, label: string, onClick: () => void) => <button key={label} type="button" aria-pressed={selected} disabled={disabled} onClick={onClick} className={`chip ${selected ? "job-builder-chip-selected" : ""}`}>{label}</button>;

  return <section className="card job-builder-section job-practical">
    <h2>Tid och period <span className="job-builder-optional">Valfritt</span></h2>
    <p className="job-builder-help">Gör det lätt för den sökande att jämföra. Välj Ej bestämt om ni inte vet än; då visas inget i annonsen.</p>

    <p id="job-practical-start-label" className="job-builder-label">När börjar jobbet?</p>
    <div className="job-builder-chips" role="group" aria-labelledby="job-practical-start-label">
      {(Object.entries(START_MODES) as [keyof typeof START_MODES, string][]).map(([mode, label]) => chip(value.startMode === mode, label, () => set({ startMode: mode })))}
      {chip(!value.startMode, "Ej bestämt", () => set({ startMode: "", startDate: "" }))}
    </div>
    {value.startMode === "date" && <label className={styles.date}>Startdatum<input type="date" className="input-field" min={today} value={value.startDate} onChange={event => set({ startDate: event.target.value })} {...field("startDate")} /></label>}
    {message("startDate")}

    <div className="job-builder-age job-practical-hours"><span>Ungefär hur många timmar per vecka?</span><div>
      <label>Från<input className="input-field" inputMode="numeric" maxLength={2} placeholder="T.ex. 8" value={value.hoursMin} onChange={event => set({ hoursMin: event.target.value.replace(/\D/g, "") })} {...field("hoursMin")} /></label><b>—</b>
      <label>Till<input className="input-field" inputMode="numeric" maxLength={2} placeholder={`Högst ${MAX_WEEKLY_HOURS}`} value={value.hoursMax} onChange={event => set({ hoursMax: event.target.value.replace(/\D/g, "") })} {...field("hoursMax")} /></label>
    </div></div>
    {message("hoursMin")}{message("hoursMax")}

    <p id="job-practical-times-label" className="job-builder-label">När på veckan?</p>
    <div className="job-builder-chips" role="group" aria-labelledby="job-practical-times-label">
      {(Object.entries(WORK_TIMES) as [WorkTime, string][]).map(([time, label]) => chip(value.times.includes(time), label, () => set({ times: value.times.includes(time) ? value.times.filter(item => item !== time) : [...value.times, time] })))}
    </div>

    <p id="job-practical-period-label" className="job-builder-label">Anställningsperiod</p>
    <div className="job-builder-chips" role="group" aria-labelledby="job-practical-period-label">
      {(Object.entries(PERIOD_MODES) as [keyof typeof PERIOD_MODES, string][]).map(([mode, label]) => chip(value.periodMode === mode, label, () => set({ periodMode: mode })))}
      {chip(!value.periodMode, "Ej bestämt", () => set({ periodMode: "", periodEnd: "" }))}
    </div>
    {value.periodMode === "until" && <label className={styles.date}>Sista anställningsdag<input type="date" className="input-field" min={value.startMode === "date" && value.startDate ? value.startDate : today} value={value.periodEnd} onChange={event => set({ periodEnd: event.target.value })} {...field("periodEnd")} /></label>}
    {message("periodEnd")}

    <label className={styles.date}><span>Sista ansökningsdag <em>(valfritt)</em></span><input type="date" className="input-field" min={today} value={value.deadline} onChange={event => set({ deadline: event.target.value })} {...field("deadline")} /><small>Visas i annonsen. Annonsen pausas inte automatiskt; pausa eller avsluta den själv.</small></label>
    {message("deadline")}
  </section>;
}
