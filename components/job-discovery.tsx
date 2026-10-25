"use client";

import { BrandLogo } from "@/components/brand-logo";
import { DISTANCE_CHOICES, searchHref, type SearchFilterValues } from "@/lib/job-search";
import { SEARCH_ORIGIN_CITIES } from "@/lib/job-location";
import { WORK_TIMES } from "@/lib/job-practical";
import { categoryLabel } from "@/lib/job-categories";
import { jobCities } from "@/lib/job-workplaces";



import Link from "next/link";
import {NotificationLink} from "./notification-link";
import { useRef } from "react";
import { JobSwipeDeck } from "./job-swipe-deck";
import { UiIcon } from "./ui-icon";
import styles from "./job-discovery.module.css";
import type { JobPost, SwipeDecision } from "@/lib/types";

export type DiscoveryFilterValues = SearchFilterValues;
export interface DiscoveryFilterOptions { cities: string[]; categories: string[]; employmentTypes: string[]; }
interface Props {
  undoTitle?: string; undoing?: boolean; undoDisabled?: boolean; onUndo?: () => Promise<void>;
  resultCount?: number; hasMore?: boolean; onLoadMore?: () => void; onSeen?: (id: string) => Promise<void>;
  jobs: JobPost[]; savedJobs: JobPost[]; savedIds: Set<string>; showingSaved: boolean;
  cvCompleted: boolean; draftCount: number; loading: boolean; error: string; notice?:string;
  filters: DiscoveryFilterValues; options: DiscoveryFilterOptions;
  onFilter: (key: keyof DiscoveryFilterValues, value: string) => void;
  onDecision: (job: JobPost, decision: SwipeDecision) => Promise<void>;
  onSave: (job: JobPost, saved: boolean) => Promise<void>;
}

export function JobDiscovery({ resultCount, undoTitle, undoing, undoDisabled, onUndo, hasMore, onLoadMore, onSeen, jobs, savedJobs, savedIds, showingSaved, loading, error, notice, filters, options, onFilter, onDecision, onSave }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const current = jobs[0];
  const reset = () => { for (const key of Object.keys(filters)) onFilter(key as keyof DiscoveryFilterValues, ""); };
  const activeFilters = Object.values(filters).some(Boolean);
  const filterLabel = (key: string, value: string) => key === "category" ? categoryLabel(value) : key === "workTime" ? WORK_TIMES[value as keyof typeof WORK_TIMES] : key === "nearbyCity" ? `Inom ca ${filters.radiusKm} km från ${value} centrum` : key === "onlyKnown" ? "Bara angivna uppgifter" : value;
  const removeFilter = (key: keyof DiscoveryFilterValues) => { onFilter(key, ""); };

  return <main className={styles.page}>
    <header className={styles.header}><div><Link href="/swipe" className={styles.mobileBrand}><BrandLogo/></Link><h1>{showingSaved ? "Dina sparade jobb." : "Hitta något som passar dig."}</h1><p>{showingSaved ? "Jobben du vill återkomma till, samlade på ett ställe." : "Jobb nära dig, på dina villkor."}</p></div><div className={styles.headerActions}><NotificationLink/>{!showingSaved && <button type="button" className={styles.filterButton} aria-label="Filtrera jobb" onClick={() => dialog.current?.showModal()}><UiIcon name="filter"/><span>Filter</span></button>}</div></header>
    <div className={styles.layout}><section className={styles.mainColumn} aria-label="Upptäck jobb">
      <div className={styles.filters}><Link href="/swipe" className={`${styles.filterChip} ${!showingSaved ? styles.selected : ""}`}>Kort</Link><Link href={searchHref("/kartan", filters)} className={styles.filterChip}><UiIcon name="map" width="16"/>Karta</Link>{!showingSaved && Object.entries(filters).filter(([key,value]) => value && key !== "radiusKm" && key !== "query").map(([key,value]) => <button type="button" key={key} className={styles.filterChip} onClick={() => removeFilter(key as keyof DiscoveryFilterValues)} aria-label={`Ta bort filter ${filterLabel(key, value)}`}>{filterLabel(key, value)}<UiIcon name="close" width="14" height="14"/></button>)}<Link href="/swipe?saved=1" className={`${styles.filterChip} ${showingSaved ? styles.selected : ""}`}>Sparade jobb</Link>{activeFilters && !showingSaved && <button type="button" className={styles.clearFilters} onClick={reset}>Rensa</button>}</div>
      {!showingSaved && <div className={styles.searchBox}><label htmlFor="discovery-search">Sök jobb</label><div><input id="discovery-search" type="search" maxLength={200} value={filters.query} placeholder="Jobb, företag eller sökord" onChange={event => onFilter("query", event.target.value)}/>{filters.query && <button type="button" onClick={() => onFilter("query", "")} aria-label="Rensa söktext">Rensa</button>}</div><p role="status">{loading ? "Hämtar jobb…" : `${resultCount ?? jobs.length} jobb${activeFilters ? " med dina sökval" : " att upptäcka"}`}</p></div>}
      {(undoTitle || undoing) && <div className={styles.undoNotice}><span role="status">{undoing ? "Ångrar bortvalet…" : `Du valde Inte nu för ${undoTitle}.`}</span><button type="button" className={styles.filterButton} disabled={undoing || undoDisabled} onClick={() => void onUndo?.()} aria-label={`Ångra bortval av ${undoTitle ?? "jobbet"}`}>Ångra</button></div>}
      {notice && <p className={styles.sentNotice} role="status"><UiIcon name="check" width="17"/>{notice}</p>}{error && <div role="alert" className={styles.error}>{error}</div>}{loading ? <div className={styles.skeleton} role="status"><UiIcon name="briefcase"/><p>Hämtar jobb…</p></div> : error && !jobs.length ? null : <JobSwipeDeck searchFilters={showingSaved ? undefined : filters} disabled={undoing} onSeen={onSeen} jobs={jobs} onDecision={onDecision} onSave={onSave} savedIds={savedIds} onClearFilters={activeFilters && !showingSaved ? reset : undefined} emptyTitle={hasMore ? "Fler jobb finns att upptäcka" : showingSaved ? "Inga sparade jobb ännu" : activeFilters ? "Inga jobb matchar dina filter" : "Du har upptäckt alla jobb här"} emptySubtitle={hasMore ? "Välj Visa fler jobb för att fortsätta." : showingSaved ? "Tryck på bokmärket på ett jobb som du vill återkomma till." : activeFilters ? "Prova att rensa ett filter för att se fler jobb." : "Nya möjligheter dyker upp löpande. Titta tillbaka snart."} interestedLabel="Intresserad" skipLabel="Inte nu" swipeHint="Swipa eller välj med knapparna"/>}
      {hasMore && !loading && <button type="button" className={styles.filterButton} onClick={onLoadMore}>Visa fler jobb</button>}
      {!showingSaved && <p className={styles.swipeHint}>Ovisade jobb visas först. Dina jobbönskemål och ort påverkar ordningen, med variation mellan företag. Vi sparar privat vilka kort du sett. Sparade jobb finns kvar separat.</p>}
    </section><aside className={styles.sidebar} aria-label="Jobbinformation och sparade jobb">
      {current && <section className={styles.sideCard}><h2>Om det här jobbet</h2><ul>{[current.city && `Plats: ${jobCities(current)}`,current.employment_type,current.salary_per_hour && `Lön: ${current.salary_per_hour}`].filter(Boolean).map((text,index) => <li key={index}><UiIcon name="check" width="18" height="18"/><span>{text}</span></li>)}</ul>{current.description && <p className={styles.description}>{current.description}</p>}<Link href={`/jobb/${encodeURIComponent(current.id)}`} className={styles.textLink}>Läs hela annonsen <UiIcon name="arrow" width="17" height="17"/></Link></section>}
      <section className={styles.sideCard}><h2>Sparat för senare</h2>{savedJobs.length ? <div className={styles.savedList}>{savedJobs.slice(0,3).map(job => <Link href={`/jobb/${encodeURIComponent(job.id)}`} key={job.id}><span className={styles.companyAvatar}>{(job.company_name || "J").slice(0,2).toUpperCase()}</span><span><strong>{job.title}</strong><small>{job.company_name} · {jobCities(job)}</small></span></Link>)}</div> : <p className={styles.savedEmpty}>Spara ett jobb med bokmärket så hittar du det här.</p>}<Link href="/swipe?saved=1" className={styles.textLink}>Visa sparade jobb <UiIcon name="arrow" width="17" height="17"/></Link></section>
      <Link href="/applications" className={styles.applicationLink}><UiIcon name="activity"/><span>Dina ansökningar och frågor</span><UiIcon name="arrow" width="17" height="17"/></Link>
    </aside></div>
    <dialog ref={dialog} className={styles.filterDialog} aria-labelledby="discovery-filter-title"><div className={styles.dialogHeader}><h2 id="discovery-filter-title">Hitta rätt jobb</h2><button type="button" aria-label="Stäng filter" onClick={() => dialog.current?.close()}><UiIcon name="close"/></button></div><p>Välj vad du vill utforska.</p><div className={styles.filterFields}>{([{key:"city",label:"Ort",all:"Alla orter",values:options.cities},{key:"category",label:"Kategori",all:"Alla kategorier",values:options.categories},{key:"employmentType",label:"Anställningsform",all:"Alla former",values:options.employmentTypes},{key:"workTime",label:"Arbetstid",all:"Alla arbetstider",values:Object.keys(WORK_TIMES)}] as const).map(field => <label key={field.key}>{field.label}<select value={filters[field.key]} onChange={event => onFilter(field.key,event.target.value)}><option value="">{field.all}</option>{[...new Set([...field.values, ...(filters[field.key] ? [filters[field.key]] : [])])].map(value => <option key={value} value={value}>{field.key === "category" ? categoryLabel(value) : field.key === "workTime" ? WORK_TIMES[value as keyof typeof WORK_TIMES] : value}</option>)}</select></label>)}<label>Avstånd från ortens centrum<select value={filters.nearbyCity} onChange={event => onFilter("nearbyCity", event.target.value)}><option value="">Ingen avståndsgräns</option>{SEARCH_ORIGIN_CITIES.map(value => <option key={value} value={value}>{value}</option>)}</select></label>{filters.nearbyCity && <label>Ungefärligt avstånd<select value={filters.radiusKm} onChange={event => onFilter("radiusKm", event.target.value)}>{DISTANCE_CHOICES.map(value => <option key={value} value={value}>Inom {value} km</option>)}</select></label>}<p className={styles.filterHelp}>Avståndet är fågelvägen från ortens centrum till närmaste kända arbetsplats, inte restid. Vissa platsmarkeringar är ungefärliga. Ort och avstånd är separata filter.</p><label className={styles.unknownChoice}><input type="checkbox" checked={filters.onlyKnown !== "yes"} onChange={event => onFilter("onlyKnown", event.target.checked ? "" : "yes")}/>Ta även med jobb där vald arbetstid eller plats är okänd</label><p className={styles.filterHelp}>Saknade uppgifter räknas inte som att jobbet uppfyller ditt val. Vi märker dem på kortet.</p></div><div className={styles.dialogActions}><button type="button" onClick={reset}>Rensa filter</button><button type="button" onClick={() => dialog.current?.close()}>Visa {resultCount ?? jobs.length} jobb</button></div></dialog>
  </main>;
}
