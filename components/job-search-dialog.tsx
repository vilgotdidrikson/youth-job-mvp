"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ModalDialog } from "./modal-dialog";
import { UiIcon } from "./ui-icon";
import { DISTANCE_CHOICES, readSearchFilters, salarySearchError, SALARY_SEARCH_UNITS, updateSearchFilter, type SearchFilterValues } from "@/lib/job-search";
import { SEARCH_ORIGIN_CITIES } from "@/lib/job-location";
import { WORK_TIMES } from "@/lib/job-practical";
import { categoryLabel } from "@/lib/job-categories";
import type { DiscoveryFilterOptions } from "./job-discovery";
import styles from "./job-discovery.module.css";

export function JobSearchDialog({ initialValues, options, onApply, onClose }: {
  initialValues: SearchFilterValues; options: DiscoveryFilterOptions;
  onApply: (values: SearchFilterValues) => void; onClose: () => void;
}) {
  const [draft, setDraft] = useState(() => ({ ...initialValues }));
  const [error, setError] = useState("");
  const closed = useRef(false);
  useEffect(() => { closed.current = false; return () => { closed.current = true; }; }, []);
  const change = (key: keyof SearchFilterValues, value: string) => {
    if (closed.current) return;
    setDraft(current => updateSearchFilter(current, key, value)); setError("");
  };
  const close = () => { if (!closed.current) { closed.current = true; onClose(); } };
  const apply = (event: FormEvent) => {
    event.preventDefault(); if (closed.current) return;
    const invalid = salarySearchError(draft);
    if (invalid) { setError(invalid); return; }
    closed.current = true;
    onApply(readSearchFilters({ get: key => draft[key as keyof SearchFilterValues] ?? null }));
    onClose();
  };
  return <ModalDialog labelledBy="discovery-filter-title" onClose={close} className={styles.filterDialog}>
    <form onSubmit={apply}>
      <div className={styles.dialogHeader}><h2 id="discovery-filter-title">Hitta rätt jobb</h2><button type="button" aria-label="Avbryt filterändringar" onClick={close}><UiIcon name="close"/></button></div>
      <p>Valen används när du väljer Tillämpa filter. Stänger du behåller du tidigare val.</p>
      <div className={styles.filterFields}>
        {([{ key: "city", label: "Ort", all: "Alla orter", values: options.cities }, { key: "category", label: "Kategori", all: "Alla kategorier", values: options.categories }, { key: "employmentType", label: "Anställningsform", all: "Alla former", values: options.employmentTypes }, { key: "workTime", label: "Arbetstid", all: "Alla arbetstider", values: Object.keys(WORK_TIMES) }] as const).map(field => <label key={field.key}>{field.label}<select value={draft[field.key]} onChange={event => change(field.key, event.target.value)}><option value="">{field.all}</option>{[...new Set([...field.values, ...(draft[field.key] ? [draft[field.key]] : [])])].map(value => <option key={value} value={value}>{field.key === "category" ? categoryLabel(value) : field.key === "workTime" ? WORK_TIMES[value as keyof typeof WORK_TIMES] : value}</option>)}</select></label>)}
        <label>Avstånd från ortens centrum<select value={draft.nearbyCity} onChange={event => change("nearbyCity", event.target.value)}><option value="">Ingen avståndsgräns</option>{SEARCH_ORIGIN_CITIES.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        {draft.nearbyCity && <label>Ungefärligt avstånd<select value={draft.radiusKm} onChange={event => change("radiusKm", event.target.value)}>{DISTANCE_CHOICES.map(value => <option key={value} value={value}>Inom {value} km</option>)}</select></label>}
        <p className={styles.filterHelp}>Avståndet är fågelvägen från ortens centrum till närmaste kända arbetsplats, inte restid. Ort och avstånd är separata filter.</p>
        <label>Lönetyp<select value={draft.salaryUnit} onChange={event => change("salaryUnit", event.target.value)}><option value="">Alla lönetyper</option>{Object.entries(SALARY_SEARCH_UNITS).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        {draft.salaryUnit && <label>Minst annonserad lägstalön ({draft.salaryUnit === "hour" ? "kr/timme" : "kr/månad"})<input inputMode="numeric" type="text" maxLength={9} value={draft.salaryMin} onChange={event => change("salaryMin", event.target.value)} aria-invalid={!!error} aria-describedby="salary-search-help salary-search-error" placeholder="Valfritt belopp"/></label>}
        <p id="salary-search-help" className={styles.filterHelp}>Lön jämförs bara när belopp och enhet framgår. Timlön och månadslön räknas inte om. Ett intervalls lägsta belopp används; enbart ”upp till” ger ingen känd lägstalön.</p>
        <label className={styles.unknownChoice}><input type="checkbox" checked={draft.onlyKnown !== "yes"} onChange={event => change("onlyKnown", event.target.checked ? "" : "yes")}/>Ta även med jobb där vald arbetstid, plats eller jämförbar lön saknas</label>
        <p className={styles.filterHelp}>Saknade uppgifter räknas inte som att jobbet uppfyller ditt val. Vi märker dem på kortet.</p>
        <p id="salary-search-error" role={error ? "alert" : undefined}>{error}</p>
      </div>
      <div className={styles.dialogActions}><button type="button" onClick={() => { if (!closed.current) { setDraft(readSearchFilters(new URLSearchParams())); setError(""); } }}>Rensa filter</button><button type="button" onClick={close}>Avbryt</button><button type="submit">Tillämpa filter</button></div>
    </form>
  </ModalDialog>;
}
