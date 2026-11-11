"use client";
import {useEffect,useRef,useState} from "react";
import {useSession} from "@/hooks/use-session";
import {loadJobInsight} from "@/lib/job-requirements-insight";
import {JobInsightError} from "@/lib/job-requirements-information";
import {PublicJobInformation,type PublicJobInformationData} from "./public-job-information";
export function JobRequirementsInsight({jobId}:{jobId:string}) {
 const {user,loading}=useSession();
 return <InsightPanel key={`${loading?"loading":user?.id??"anonymous"}:${jobId}`} jobId={jobId} ownerId={loading?null:user?.id??null}/>;
}
function InsightPanel({jobId,ownerId}:{jobId:string;ownerId:string|null}) {
 const [data,setData]=useState<PublicJobInformationData|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 const request=useRef<AbortController|null>(null),active=useRef(false);
 useEffect(()=>{active.current=true;return()=>{active.current=false;const current=request.current;request.current=null;current?.abort();};},[]);
 const load=async()=>{
  if(!active.current||request.current||!ownerId)return;
  const current=new AbortController();request.current=current;setBusy(true);setError("");setData(null);
  try{const value=await loadJobInsight(ownerId,jobId,current.signal);if(active.current&&!current.signal.aborted)setData(value);}
  catch(reason){if(active.current&&!current.signal.aborted)setError(reason instanceof JobInsightError?reason.message:"Kravinformationen kunde inte hämtas. Försök igen.");}
  finally{if(request.current===current){request.current=null;if(active.current)setBusy(false);}}
 };
 return <details onToggle={event=>{if(event.currentTarget.open)void load();}}>
  <summary>Se vad företaget söker</summary>
  {!ownerId?<p>Logga in för att läsa kravinformationen för din ansökan.</p>:<>
   {busy?<p role="status">Hämtar annons…</p>:error?<p role="alert">{error} <button type="button" onClick={()=>void load()}>Försök igen</button></p>:data?<PublicJobInformation job={data}/>:null}
   {data&&<button type="button" className="secondary-btn" onClick={()=>void load()}>Uppdatera annonsinformationen</button>}
  </>}
 </details>;
}
