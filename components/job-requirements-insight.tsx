"use client";
import { useEffect,useRef,useState } from "react";
import { PublicJobInformation, type PublicJobInformationData } from "./public-job-information";
import { getSupabaseClient } from "@/lib/supabase";
interface Insight extends PublicJobInformationData {job_id:string}
export function JobRequirementsInsight({jobId}:{jobId:string}) { return <InsightPanel key={jobId} jobId={jobId}/>; }
function InsightPanel({jobId}:{jobId:string}) {
  const [data,setData]=useState<Insight|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  const request=useRef(0);
  useEffect(()=>{const currentRequest=request;return()=>{currentRequest.current++;};},[]);
  const load=async()=>{if(busy||data)return;const sequence=++request.current;setBusy(true);setError("");const result=await getSupabaseClient().rpc("get_job_requirement_insight",{p_job_id:jobId});if(sequence!==request.current)return;setBusy(false);if(result.error||!result.data){setError("Kravinformationen kunde inte hämtas.");return;}setData(result.data as Insight);};
  return <details onToggle={event=>{if(event.currentTarget.open)void load();}}><summary>Läs annonsens beskrivning och krav</summary>{busy?<p role="status">Hämtar annons…</p>:error?<p role="alert">{error} <button type="button" onClick={()=>void load()}>Försök igen</button></p>:data?<PublicJobInformation job={data}/>:null}</details>;
}
