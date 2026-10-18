"use client";
import { JOB_CATEGORIES, categoryLabel, suggestJobCategories, type JobCategoryId } from "@/lib/job-categories";

export function JobCategoryField({title,description,legacyCategory="",value,manual,onChange,disabled=false}:{title:string;description:string;legacyCategory?:string;value:JobCategoryId[];manual:boolean;onChange:(ids:JobCategoryId[],manual:boolean)=>void;disabled?:boolean}) {
  const suggestion=suggestJobCategories(title,description,legacyCategory);
  return <section aria-label="Gemensam jobbtyp" style={{marginTop:"1.2rem"}}>
    <p><strong>{value.length?`Jobbet visas under ${value.map(categoryLabel).join(" och ")}`:"Jobbet saknar gemensam jobbtyp"}</strong></p>
    {!value.length&&<p>{!manual&&suggestion.candidates.length>1?"Flera jobbtyper kan passa. Välj själv vilka roller annonsen gäller.":"Annonsen kan publiceras ändå och visas bland övriga jobb. Din egen titel behålls."}</p>}
    {legacyCategory&&<p><small>Tidigare kategoritext: {legacyCategory}. Originaltexten finns kvar.</small></p>}
    <details><summary>Ändra jobbtyp</summary><p>Välj upp till tre för en annons med flera roller. Jobbtypen är ett sökfilter, inte ett kompetenskrav.</p>
      <div className="job-builder-chips">{value.map(id=><button type="button" className="chip" key={id} disabled={disabled} aria-label={`Ta bort ${categoryLabel(id)}`} onClick={()=>onChange(value.filter(item=>item!==id),true)}>{categoryLabel(id)} ×</button>)}</div>
      <label>Lägg till jobbtyp<select className="input-field" value="" disabled={disabled||value.length>=3} onChange={event=>{if(event.target.value)onChange([...value,event.target.value as JobCategoryId],true);}}><option value="">Välj en jobbtyp</option>{JOB_CATEGORIES.filter(c=>!value.includes(c.id)).map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
      <button type="button" className="secondary-btn" disabled={disabled} onClick={()=>onChange([],true)}>Ingen av jobbtyperna passar</button>
      {manual&&<button type="button" className="secondary-btn" disabled={disabled} onClick={()=>onChange([],false)}>Använd förslag från titel och beskrivning</button>}
    </details>
  </section>;
}
