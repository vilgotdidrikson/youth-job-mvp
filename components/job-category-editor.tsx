"use client";
import { useState } from "react";
import { ModalDialog } from "./modal-dialog";
import { JobCategoryField } from "./job-category-field";
import { effectiveJobCategories, suggestJobCategories } from "@/lib/job-categories";
import { updateJob } from "@/lib/jobs";
import type { JobPost } from "@/lib/types";
export function JobCategoryEditor({job,onClose,onSaved}:{job:JobPost;onClose:()=>void;onSaved:(job:JobPost)=>void}) {
  const [value,setValue]=useState(()=>effectiveJobCategories(job)),[manual,setManual]=useState(job.job_category_manual??false);
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  const selected=value;
  return <ModalDialog label="Redigera jobbtyp" busy={busy} onClose={()=>{if(!busy)onClose();}}><form onSubmit={async event=>{event.preventDefault();if(busy)return;setBusy(true);setError("");try{onSaved(await updateJob(job.id,{job_category_ids:selected,job_category_manual:manual}));}catch(reason){setError(reason instanceof Error?reason.message:"Kunde inte spara jobbtypen.");}finally{setBusy(false);}}}>
    <h2>Jobbtyp för {job.title}</h2><JobCategoryField title={job.title} description={job.description} legacyCategory={job.category} value={selected} manual={manual} disabled={busy} onChange={(ids,corrected)=>{setValue(corrected?ids:suggestJobCategories(job.title,job.description,job.category).ids);setManual(corrected);}}/>{error&&<p role="alert">{error}</p>}<button className="cta-btn" disabled={busy}>{busy?"Sparar…":"Spara jobbtyp"}</button><button className="secondary-btn" type="button" disabled={busy} onClick={onClose}>Avbryt</button>
  </form></ModalDialog>;
}
