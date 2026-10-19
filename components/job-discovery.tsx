"use client";
import { categoryLabel } from "@/lib/job-categories";
import { jobCities } from "@/lib/job-workplaces";



import Link from "next/link";
import {NotificationLink} from "./notification-link";
import { useRef } from "react";
import { JobSwipeDeck } from "./job-swipe-deck";
import { UiIcon } from "./ui-icon";
import styles from "./job-discovery.module.css";
import type { JobPost, SwipeDecision } from "@/lib/types";

export interface DiscoveryFilterValues { city: string; category: string; employmentType: string; }
export interface DiscoveryFilterOptions { cities: string[]; categories: string[]; employmentTypes: string[]; }
interface Props {
  hasMore?: boolean; onLoadMore?: () => void; onSeen?: (id: string) => Promise<void>;
  jobs: JobPost[]; savedJobs: JobPost[]; savedIds: Set<string>; showingSaved: boolean;
  cvCompleted: boolean; draftCount: number; loading: boolean; error: string; notice?:string;
  filters: DiscoveryFilterValues; options: DiscoveryFilterOptions;
  onFilter: (key: keyof DiscoveryFilterValues, value: string) => void;
  onDecision: (job: JobPost, decision: SwipeDecision) => Promise<void>;
  onSave: (job: JobPost, saved: boolean) => Promise<void>;
}

export function JobDiscovery({ hasMore, onLoadMore, onSeen, jobs, savedJobs, savedIds, showingSaved, loading, error, notice, filters, options, onFilter, onDecision, onSave }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const current = jobs[0];
  const reset = () => { onFilter("city", ""); onFilter("category", ""); onFilter("employmentType", ""); };
  const activeFilters = Object.values(filters).some(Boolean);
  return <main className={styles.page}>
    <header className={styles.header}><div><Link href="/swipe" className={styles.mobileBrand}>MatchnWork</Link><h1>{showingSaved ? "Dina sparade jobb." : "Hitta något som passar dig."}</h1><p>{showingSaved ? "Jobben du vill återkomma till, samlade på ett ställe." : "Jobb nära dig, på dina villkor."}</p></div><div className={styles.headerActions}><NotificationLink/>{!showingSaved && <button type="button" className={styles.filterButton} aria-label="Filtrera jobb" onClick={() => dialog.current?.showModal()}><UiIcon name="filter"/><span>Filter</span></button>}</div></header>
    <div className={styles.layout}><section className={styles.mainColumn} aria-label="Upptäck jobb">
      <div className={styles.filters}><Link href="/swipe" className={`${styles.filterChip} ${!showingSaved ? styles.selected : ""}`}>Kort</Link><Link href="/kartan" className={styles.filterChip}><UiIcon name="map" width="16"/>Karta</Link>{!showingSaved && Object.entries(filters).filter(([,value]) => value).map(([key,value]) => <button type="button" key={key} className={styles.filterChip} onClick={() => onFilter(key as keyof DiscoveryFilterValues, "")} aria-label={`Ta bort filter ${key === "category" ? categoryLabel(value) : value}`}>{key === "category" ? categoryLabel(value) : value}<UiIcon name="close" width="14" height="14"/></button>)}<Link href="/swipe?saved=1" className={`${styles.filterChip} ${showingSaved ? styles.selected : ""}`}>Sparade jobb</Link>{activeFilters && !showingSaved && <button type="button" className={styles.clearFilters} onClick={reset}>Rensa</button>}</div>
      {notice && <p className={styles.sentNotice} role="status"><UiIcon name="check" width="17"/>{notice}</p>}{error && <div role="alert" className={styles.error}>{error}</div>}{loading ? <div className={styles.skeleton} role="status"><UiIcon name="briefcase"/><p>Hämtar jobb…</p></div> : error && !jobs.length ? null : <JobSwipeDeck onSeen={onSeen} jobs={jobs} onDecision={onDecision} onSave={onSave} savedIds={savedIds} onClearFilters={activeFilters && !showingSaved ? reset : undefined} emptyTitle={hasMore ? "Fler jobb finns att upptäcka" : showingSaved ? "Inga sparade jobb ännu" : activeFilters ? "Inga jobb matchar dina filter" : "Du har upptäckt alla jobb här"} emptySubtitle={hasMore ? "Välj Visa fler jobb för att fortsätta." : showingSaved ? "Tryck på bokmärket på ett jobb som du vill återkomma till." : activeFilters ? "Prova att rensa ett filter för att se fler jobb." : "Nya möjligheter dyker upp löpande. Titta tillbaka snart."} interestedLabel="Intresserad" skipLabel="Inte nu" swipeHint="Swipa eller välj med knapparna"/>}
      {hasMore && !loading && <button type="button" className={styles.filterButton} onClick={onLoadMore}>Visa fler jobb</button>}
      {!showingSaved && <p className={styles.swipeHint}>Ovisade jobb visas först. Dina jobbönskemål och ort påverkar ordningen, med variation mellan företag. Vi sparar privat vilka kort du sett. Sparade jobb finns kvar separat.</p>}
    </section><aside className={styles.sidebar} aria-label="Jobbinformation och sparade jobb">
      {current && <section className={styles.sideCard}><h2>Om det här jobbet</h2><ul>{[current.city && `Plats: ${jobCities(current)}`,current.employment_type,current.salary_per_hour && `Lön: ${current.salary_per_hour}`].filter(Boolean).map((text,index) => <li key={index}><UiIcon name="check" width="18" height="18"/><span>{text}</span></li>)}</ul>{current.description && <p className={styles.description}>{current.description}</p>}<Link href={`/jobb/${encodeURIComponent(current.id)}`} className={styles.textLink}>Läs hela annonsen <UiIcon name="arrow" width="17" height="17"/></Link></section>}
      <section className={styles.sideCard}><h2>Sparat för senare</h2>{savedJobs.length ? <div className={styles.savedList}>{savedJobs.slice(0,3).map(job => <Link href={`/jobb/${encodeURIComponent(job.id)}`} key={job.id}><span className={styles.companyAvatar}>{(job.company_name || "J").slice(0,2).toUpperCase()}</span><span><strong>{job.title}</strong><small>{job.company_name} · {jobCities(job)}</small></span></Link>)}</div> : <p className={styles.savedEmpty}>Spara ett jobb med bokmärket så hittar du det här.</p>}<Link href="/swipe?saved=1" className={styles.textLink}>Visa sparade jobb <UiIcon name="arrow" width="17" height="17"/></Link></section>
      <Link href="/applications" className={styles.applicationLink}><UiIcon name="activity"/><span>Dina ansökningar och frågor</span><UiIcon name="arrow" width="17" height="17"/></Link>
    </aside></div>
    <dialog ref={dialog} className={styles.filterDialog} aria-labelledby="discovery-filter-title"><div className={styles.dialogHeader}><h2 id="discovery-filter-title">Hitta rätt jobb</h2><button type="button" aria-label="Stäng filter" onClick={() => dialog.current?.close()}><UiIcon name="close"/></button></div><p>Välj vad du vill utforska.</p><div className={styles.filterFields}>{([{key:"city",label:"Ort",all:"Alla orter",values:options.cities},{key:"category",label:"Kategori",all:"Alla kategorier",values:options.categories},{key:"employmentType",label:"Anställningsform",all:"Alla former",values:options.employmentTypes}] as const).map(field => <label key={field.key}>{field.label}<select value={filters[field.key]} onChange={event => onFilter(field.key,event.target.value)}><option value="">{field.all}</option>{field.values.map(value => <option key={value} value={value}>{field.key === "category" ? categoryLabel(value) : value}</option>)}</select></label>)}</div><div className={styles.dialogActions}><button type="button" onClick={reset}>Rensa filter</button><button type="button" onClick={() => dialog.current?.close()}>Visa {jobs.length} jobb</button></div></dialog>
  </main>;
}
