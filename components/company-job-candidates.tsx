"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCompanyCandidates } from "@/hooks/use-company-candidates";
import { COMPANY_ROUTES, companyJobCandidatesHref } from "@/lib/company-navigation";
import { filterCandidates, selectCandidate } from "@/lib/candidate-selection";
import { createLatestRead, type ReadState } from "@/lib/latest-read";
import { authenticatedHeaders } from "@/lib/api-client";
import { reviewCandidate } from "@/lib/matching";
import { jobPublicationLabel } from "@/lib/job-publication";
import { TabList } from "@/components/tab-list";
import { tabPanelProps } from "@/lib/tab-keyboard";
import { ModalDialog } from "@/components/modal-dialog";
import { UiIcon } from "@/components/ui-icon";
import { CandidateRecruitmentProfile } from "@/components/candidate-recruitment-profile";
import { CandidateAssessmentPanel } from "@/components/candidate-assessment-panel";
import { CandidateVerifiedJobBadge } from "@/components/verified-job-badge";
import { RecruitmentSummary } from "@/components/recruitment-summary";
import { WorkplacePreference } from "@/components/workplace-preference";
import type { JobPost, CandidateFeedItem, SwipeDecision } from "@/lib/types";
import styles from "./company-job-candidates.module.css";

type Props = { userId: string; jobs: JobPost[]; verified: boolean; jobId: string | null; candidateId: string | null };
type CandidateCv = { kind: "pdf"; url: string; expiresAt: string; candidateKey: string } | { kind: "text"; text: string; candidateKey: string };
export function CompanyJobCandidates({ userId, jobs, verified, jobId, candidateId }: Props) {
  const ownedJobs = jobs.filter(job => job.company_user_id === userId);
  const job = ownedJobs.find(row => row.id === jobId);
  if (!verified) return <section className={styles.empty}><h1>Ansökningar</h1><p>Företaget behöver verifieras innan ni kan granska ansökningar.</p><Link href={COMPANY_ROUTES.listings}>Till era annonser</Link></section>;
  if (!job) return <section className={styles.workspace}>
    <header className={styles.heading}><h1>{jobId ? "Annonsen är inte tillgänglig" : "Välj annons"}</h1><p>{jobId ? "Välj en av era annonser för att se dess ansökningar." : "Öppna den annons ni vill granska ansökningar för."}</p></header>
    <div className={styles.jobs}>{ownedJobs.map(row => <Link className={styles.job} key={row.id} href={companyJobCandidatesHref(row.id)}><span><strong>{row.title}</strong><span>{jobPublicationLabel(row)}</span></span><UiIcon name="arrow" width="20" /></Link>)}</div>
    {!ownedJobs.length && <section className={styles.empty}><h2>Inga annonser ännu</h2><Link href={COMPANY_ROUTES.create} className="cta-btn">Skapa annons</Link></section>}
    <Link className={styles.back} href={COMPANY_ROUTES.listings}><UiIcon name="chevron-left" width="18" />Till era annonser</Link>
  </section>;
  return <JobApplications key={`${userId}:${job.id}`} userId={userId} job={job} candidateId={candidateId} />;
}

function JobApplications({ userId, job, candidateId }: { userId: string; job: JobPost; candidateId: string | null }) {
  const router = useRouter();
  const { state, reload } = useCompanyCandidates(userId, job.id);
  const [filterChoice, setCandidateFilter] = useState<"pending" | "all">(candidateId ? "all" : "pending");
  const [candidateSearch, setCandidateSearch] = useState("");
  const [candidateActionKey, setCandidateActionKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const writeLock = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const candidateFeed = state.status === "ready" ? state.value.candidates : [];
  const pendingCandidates = candidateFeed.filter(candidate => !candidate.reviewDecision);
  const candidateFilter = candidateId && candidateFeed.some(row => row.youthUserId === candidateId && row.reviewDecision) ? "all" : filterChoice;
  const displayedCandidates = candidateFilter === "all" ? candidateFeed : pendingCandidates;
  const filteredCandidates = filterCandidates(displayedCandidates, candidateSearch);
  const selectedCandidateId = candidateId ? `${job.id}:${candidateId}` : null;
  const selectedCandidate = selectCandidate(filteredCandidates, selectedCandidateId);
  const selectedKey = selectedCandidate ? `${job.id}:${selectedCandidate.youthUserId}` : "";
  const selectedConversation = state.status === "ready" && selectedCandidate ? state.value.conversations.find(row => row.job_id === job.id && row.youth_user_id === selectedCandidate.youthUserId) : null;
  const [cvEpoch, setCvEpoch] = useState(0);
  const [matchedConversationId, setMatchedConversationId] = useState<string | null>(null);
  const [cvState, setCvState] = useState<{ key: string; source: object; state: ReadState<CandidateCv> }>();
  const cvReader = useRef<ReturnType<typeof createLatestRead<CandidateCv, CandidateFeedItem>> | null>(null);
  useEffect(() => {
    if (!selectedKey) return;
    const current = createLatestRead<CandidateCv, CandidateFeedItem>({
      read: async (candidate, signal) => {
        if (`${candidate.job.id}:${candidate.youthUserId}` !== selectedKey) throw new Error("Ansökan har ändrats.");
        const response = await fetch("/api/company/candidate-cv", { method: "POST", signal,
          headers: { "Content-Type": "application/json", ...(await authenticatedHeaders()) }, body: JSON.stringify({ jobId: job.id, youthUserId: candidate.youthUserId }) });
        const result = await response.json();
        if (!response.ok) throw new Error("CV kunde inte hämtas.");
        if (result.kind === "pdf" && typeof result.url === "string" && typeof result.expiresAt === "string") return { kind: "pdf", url: result.url, expiresAt: result.expiresAt, candidateKey: selectedKey };
        if (result.kind === "text" && typeof result.text === "string") return { kind: "text", text: result.text, candidateKey: selectedKey };
        throw new Error("Ogiltigt CV-svar.");
      }, update: next => setCvState({ key: selectedKey, source: state, state: next }), errorMessage: "CV:t kunde inte öppnas. Försök igen.",
    });
    cvReader.current = current;
    return () => { current.stop(); if (cvReader.current === current) cvReader.current = null; };
  }, [selectedKey, job.id, cvEpoch, state]);
  const candidateCv = cvState?.key === selectedKey && cvState.source === state && cvState.state.status === "ready" ? cvState.state.value : null;
  const openingUploadedCv = cvState?.key === selectedKey && cvState.source === state && cvState.state.status === "loading";
  const uploadedCvError = cvState?.key === selectedKey && cvState.source === state && cvState.state.status === "error" ? cvState.state.message : "";
  const closeCv = () => { cvReader.current?.stop(); setCvState(undefined); setCvEpoch(value => value + 1); };
  const clearCandidate = () => { router.replace(companyJobCandidatesHref(job.id), { scroll: false }); };
  const chooseCandidate = (id: string) => { router.replace(companyJobCandidatesHref(job.id, id), { scroll: false }); };
  const handleApplicantDecision = async (candidate: CandidateFeedItem, decision: SwipeDecision) => {
    if (writeLock.current || candidate.job.id !== job.id || candidate.job.company_user_id !== userId) return;
    writeLock.current = true; setCandidateActionKey(`${job.id}:${candidate.youthUserId}`); setActionError("");
    try {
      const result = await reviewCandidate(job.id, candidate.youthUserId, decision);
      if (!alive.current) return;
      if (decision === "interested" && result?.conversation_id) setMatchedConversationId(result.conversation_id);
      clearCandidate(); await reload();
    } catch (error) { if (alive.current) setActionError(error instanceof Error ? error.message : "Beslutet kunde inte sparas."); }
    finally { writeLock.current = false; if (alive.current) setCandidateActionKey(null); }
  };
  return <section className={`company-applicants ${styles.workspace}`} aria-label="Ansökningar till vald annons">
    <Link className={styles.back} href={COMPANY_ROUTES.candidates}><UiIcon name="chevron-left" width="18" />Byt annons</Link>
    <header className={styles.heading}><h1>{job.title}</h1><p>{state.status === "ready" ? `${candidateFeed.length} ansökningar` : "Ansökningar"}</p></header>
    {matchedConversationId && <p role="status" className={styles.match}>Ni kan nu chatta. <Link href={`/chats?conversation=${encodeURIComponent(matchedConversationId)}`}>Öppna chatten</Link></p>}
    <RecruitmentSummary company jobId={job.id} />
    {actionError && <p role="alert">{actionError}</p>}
    {state.status === "loading" ? <p role="status">Hämtar ansökningar…</p> : state.status === "error" ? <section className={styles.empty}><p role="alert">{state.message}</p><button className="secondary-btn" type="button" onClick={() => void reload()}>Försök igen</button></section> : <>
          <TabList id="company-applications" label="Visa ansökningar" className="company-application-tabs" items={[{ value: "pending", label: <>Att granska <span>{pendingCandidates.length}</span></> }, { value: "all", label: <>Alla ansökningar <span>{candidateFeed.length}</span></> }]} value={candidateFilter} onChange={(filter) => {setCandidateFilter(filter);clearCandidate();closeCv();}} />
          {candidateFilter === "pending" && !pendingCandidates.length && candidateFeed.length > 0 ? <section className="card company-applicants-empty" {...tabPanelProps("company-applications", candidateFilter)}><UiIcon name="check" width="30" /><h2>Alla ansökningar är granskade</h2><p>Tidigare kandidater och deras kompletteringar finns kvar under Alla ansökningar.</p><button type="button" className="secondary-btn" onClick={() => setCandidateFilter("all")}>Visa alla ansökningar</button></section> : candidateFeed.length === 0 ? (
            <div className="card company-applicants-empty" {...tabPanelProps("company-applications", candidateFilter)}><h2>Inga ansökningar ännu</h2><p>När någon söker den här annonsen visas ansökan här.</p></div>
          ) : (
            <div className="company-applicants-layout" {...tabPanelProps("company-applications", candidateFilter)}>
              <div className="company-applicant-sidebar"><label className="company-candidate-search">Sök bland ansökningar<input className="input-field" type="search" value={candidateSearch} onChange={(event) => {setCandidateSearch(event.target.value);clearCandidate();closeCv();}} placeholder="Sök på namn…" /></label><div className="company-applicant-list">
                {filteredCandidates.map((candidate) => {
                  const profile = candidate.profile;
                  const isSelected = selectedCandidate?.youthUserId === candidate.youthUserId && selectedCandidate?.job.id === candidate.job.id;
                  return <button key={`${candidate.youthUserId}-${candidate.job.id}`} type="button" className={`company-applicant-row${isSelected ? " is-selected" : ""}`} aria-pressed={isSelected} onClick={() => { chooseCandidate(candidate.youthUserId); closeCv(); }}>
                    <span className="company-applicant-avatar">{(profile?.full_name?.trim().charAt(0) || "?").toUpperCase()}</span>
                    <span><strong>{profile?.full_name || "Anonym kandidat"}</strong>{candidate.reviewDecision && <em className="company-application-reviewed">{candidate.reviewDecision === "interested" ? "Intresse visat" : "Avslutad"}</em>}</span>
                    <span aria-hidden="true">›</span>
                  </button>;
                })}
              </div>{candidateSearch.trim() && !filteredCandidates.length && <p className="company-search-empty" role="status">Inga ansökningar matchar din sökning.</p>}</div>
              {!selectedCandidate && <section className="card company-applicants-empty"><h2>{selectedCandidateId ? "Ansökan är inte tillgänglig" : "Ingen kandidat att visa"}</h2><p>{selectedCandidateId ? "Välj en annan kandidat i listan för att fortsätta." : "Prova ett annat namn för att hitta en ansökan."}</p></section>}
              {selectedCandidate && <article className="company-candidate-profile card">
                <header><div className="company-candidate-profile-avatar">{(selectedCandidate.profile?.full_name?.trim().charAt(0) || "?").toUpperCase()}</div><div><p>Kandidat</p><h2>{selectedCandidate.profile?.full_name || "Anonym kandidat"}</h2><CandidateVerifiedJobBadge key={`${selectedCandidate.job.id}:${selectedCandidate.youthUserId}`} youthUserId={selectedCandidate.youthUserId} jobId={selectedCandidate.job.id}/><span>{[selectedCandidate.profile?.age ? `${selectedCandidate.profile.age} år` : "", selectedCandidate.profile?.city].filter(Boolean).join(" · ") || "Plats ej angiven"}</span></div></header>
                <section aria-label="Kandidatens CV"><button type="button" className="cta-btn company-candidate-cv-button" onClick={() => void cvReader.current?.load(selectedCandidate)} disabled={openingUploadedCv}>{openingUploadedCv ? "Hämtar CV..." : "Öppna CV"}</button>{uploadedCvError && <p role="alert" className="company-candidate-cv-error">{uploadedCvError}</p>}</section>
                <WorkplacePreference key={`workplace:${selectedCandidate.job.id}:${selectedCandidate.youthUserId}`} job={selectedCandidate.job} youthId={selectedCandidate.youthUserId} readOnly/>
                <CandidateRecruitmentProfile key={`${selectedCandidate.job.id}:${selectedCandidate.youthUserId}`} jobId={selectedCandidate.job.id} youthId={selectedCandidate.youthUserId}/><CandidateAssessmentPanel key={`${selectedCandidate.job.id}:${selectedCandidate.youthUserId}`} jobId={selectedCandidate.job.id} youthUserId={selectedCandidate.youthUserId} application={selectedCandidate.application} />
                {selectedCandidate.reviewDecision ? <section className="company-reviewed-application"><UiIcon name={selectedCandidate.reviewDecision === "interested" ? "check" : "info"} width="22" /><div><strong>{selectedCandidate.reviewDecision === "interested" ? "Ni har visat intresse" : "Ansökan är avslutad"}</strong><p>Ansökan och kompletteringarna finns kvar här som underlag.</p></div>{selectedCandidate.reviewDecision === "interested" && <Link href={selectedConversation ? `/chats?conversation=${selectedConversation.id}` : "/chats"} className="secondary-btn">Öppna chatten <UiIcon name="arrow" width="16" /></Link>}</section> : (() => {
                  const actionKey = `${selectedCandidate.job.id}:${selectedCandidate.youthUserId}`;
                  const isDeciding = candidateActionKey === actionKey;
                  return <section aria-label="Beslut om ansökan" className="company-candidate-decision">
                    <button
                      type="button"
                      className="secondary-btn"
                      disabled={candidateActionKey !== null}
                      onClick={() => {
                        if (window.confirm(`Neka ${selectedCandidate.profile?.full_name || "den här kandidaten"} för ${selectedCandidate.job.title}?`)) {
                          void handleApplicantDecision(selectedCandidate, "skip");
                        }
                      }}
                    >
                      {isDeciding ? "Sparar..." : "Neka"}
                    </button>
                    <button
                      type="button"
                      className="cta-btn"
                      disabled={candidateActionKey !== null}
                      onClick={() => void handleApplicantDecision(selectedCandidate, "interested")}
                    >
                      {isDeciding ? "Sparar..." : "Acceptera"}
                    </button>
                  </section>;
                })()}
              </article>}
            </div>
          )}
</>}
      {candidateCv && selectedCandidate && candidateCv.candidateKey === `${selectedCandidate.job.id}:${selectedCandidate.youthUserId}` && <ModalDialog label="Kandidatens CV" onClose={() => closeCv()} className="mnw-candidate-cv-modal"><div className="candidate-cv-dialog"><header><div><p>Fullständigt CV</p><h2>{selectedCandidate.profile?.full_name || "Anonym kandidat"}</h2><CandidateVerifiedJobBadge key={`${selectedCandidate.job.id}:${selectedCandidate.youthUserId}`} youthUserId={selectedCandidate.youthUserId} jobId={selectedCandidate.job.id}/><span>{[selectedCandidate.profile?.age ? `${selectedCandidate.profile.age} år` : "", selectedCandidate.profile?.city].filter(Boolean).join(" · ") || "Plats ej angiven"}</span></div><button type="button" onClick={() => closeCv()} aria-label="Stäng CV">×</button></header>{candidateCv.kind === "pdf" ? <iframe title={`CV för ${selectedCandidate.profile?.full_name || "kandidat"}`} src={candidateCv.url} /> : <article><p>{candidateCv.text}</p></article>}</div></ModalDialog>}
</section>;
}
