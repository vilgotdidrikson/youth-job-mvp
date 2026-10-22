"use client";
import { useEffect,useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { subscribeVisibleRefresh } from "@/lib/visible-refresh";
import type { ApplicationDisclosure } from "@/lib/application-disclosure";
import { ApplicationDisclosureView } from "./application-disclosure-view";
export function CandidateRecruitmentProfile({jobId,youthId}:{jobId:string;youthId:string}) {
  const [packet,setPacket]=useState<ApplicationDisclosure|null>(null),[error,setError]=useState("");
  useEffect(()=>{let active=true;const refresh=async()=>{const {data,error}=await getSupabaseClient().rpc("get_application_disclosure",{p_job_id:jobId,p_youth_user_id:youthId});if(active){setPacket(error?null:data as ApplicationDisclosure|null);setError(error||!data?"Ansökningsunderlaget kunde inte hämtas.":"");}};void refresh();const stop=subscribeVisibleRefresh(refresh);return()=>{active=false;stop();};},[jobId,youthId]);
  return error?<p role="alert">{error}</p>:packet?<ApplicationDisclosureView packet={packet}/>:<p role="status">Hämtar ansökningsunderlag…</p>;
}
