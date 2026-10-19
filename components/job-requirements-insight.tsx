"use client";
import { useEffect,useRef,useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
interface Insight {job_id:string;title:string;requirements:string;role_summary:string;criteria:{label:string;category:string;required:boolean}[]}
export function JobRequirementsInsight({jobId}:{jobId:string}) { return <InsightPanel key={jobId} jobId={jobId}/>; }
function InsightPanel({jobId}:{jobId:string}) {
  const [data,setData]=useState<Insight|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  const request=useRef(0);
  useEffect(()=>{const currentRequest=request;return()=>{currentRequest.current++;};},[]);
  const load=async()=>{if(busy||data)return;const sequence=++request.current;setBusy(true);setError("");const result=await getSupabaseClient().rpc("get_job_requirement_insight",{p_job_id:jobId});if(sequence!==request.current)return;setBusy(false);if(result.error||!result.data){setError("Kravinformationen kunde inte hämtas.");return;}setData(result.data as Insight);};
  return <details onToggle={event=>{if(event.currentTarget.open)void load();}}><summary>Se vad företaget söker</summary>{busy?<p role="status">Hämtar jobbkrav…</p>:error?<p role="alert">{error} <button type="button" onClick={()=>void load()}>Försök igen</button></p>:data?<><h3>{data.title}</h3>{data.role_summary&&<p>{data.role_summary}</p>}{data.requirements&&<p style={{whiteSpace:"pre-wrap"}}>{data.requirements}</p>}<ul>{data.criteria.map((criterion,index)=><li key={index}><strong>{criterion.label}</strong> · {criterion.category==="trainable"?"Kan läras på plats":criterion.category==="trait"?"Företagets önskemål – kan beskrivas med egna exempel":criterion.required?"Grundkrav":"Merit"}</li>)}</ul><p>Detta är företagets krav och önskemål. Eventuella kompletteringar är frivilliga. Svara sanningsenligt, rätta en uppgift eller avstå; inget svar ger ett löfte om högre poäng.</p></>:null}</details>;
}
