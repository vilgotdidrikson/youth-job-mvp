"use client";
import { JobRequirementsInsight } from "@/components/job-requirements-insight";
import { Suspense,useEffect,useRef,useState } from "react";
import Link from "next/link";
import { useRouter,useSearchParams } from "next/navigation";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { AuthGateMessage } from "@/components/auth-gate-message";
import { ApplicationDisclosureView } from "@/components/application-disclosure-view";
import type { DisclosurePreview } from "@/lib/application-disclosure";
import { getSupabaseClient } from "@/lib/supabase";
import { prepareApplication } from "@/lib/application-completions";
import { applicationSourceInput } from "@/lib/application-evidence";

function Preview() {
  const params=useSearchParams(),router=useRouter();const jobId=params.get("job");
  const {user,profile,status,error:authError}=useRequireAuth();
  const [preview,setPreview]=useState<DisclosurePreview|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  const [sent,setSent]=useState(false),[withdrawn,setWithdrawn]=useState(false);const sequence=useRef(0);
  const load=async(selection?:string[])=>{if(!jobId)return;const request=++sequence.current;setBusy(true);setError("");try{const {data,error}=await getSupabaseClient().rpc("get_my_application_disclosure_preview",{p_job_id:jobId,...(selection!==undefined?{p_selection:selection}:{})});if(error||!data)throw Error(error?.message||"Underlaget kunde inte hämtas.");if(request===sequence.current)setPreview(data as DisclosurePreview);}catch(reason){if(request===sequence.current)setError(reason instanceof Error?reason.message:"Underlaget kunde inte hämtas.");}finally{if(request===sequence.current)setBusy(false);}};
  const invalidateRequests=()=>{sequence.current++;};
  useEffect(()=>{if(status!=="ready"||profile?.role!=="youth"||!jobId)return;let active=true;void getSupabaseClient().from("application_completions").select("status").eq("job_id",jobId).eq("youth_user_id",user!.id).maybeSingle().then(({data})=>{if(active){setSent(data?.status==="submitted");setWithdrawn(data?.status==="withdrawn");}});void load();return()=>{active=false;invalidateRequests();};/* load is scoped to this job and account */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[jobId,status,user?.id,profile?.role]);
  const save=async(send:boolean)=>{if(!jobId||!preview||busy)return;setBusy(true);setError("");try{if(!preview.is_saved){const {error}=await getSupabaseClient().rpc("save_my_application_disclosure",{p_job_id:jobId,p_selection:preview.selected_keys,p_source_token:preview.source_token});if(error)throw Error(error.message);}if(send)await prepareApplication(jobId);window.dispatchEvent(new Event("mnw-navigation-refresh"));router.push(`/applications?job=${encodeURIComponent(jobId)}`);}catch(reason){setError(reason instanceof Error?reason.message:"Ändringen kunde inte sparas.");}finally{setBusy(false);}};
  if(status!=="ready")return <AuthGateMessage status={status} error={authError}/>;
  if(profile?.role!=="youth")return <main className="mobile-shell"><p>Förhandsvisningen är för ungdomskonton.</p></main>;
  if(withdrawn)return <main className="mobile-shell"><h1>Ansökan är återkallad</h1><p>Den skickas inte igen automatiskt. En eventuell match är avslutad och chatten är skrivskyddad.</p><Link href="/applications">Till mina ansökningar</Link></main>;
  return <main className="mobile-shell" style={{maxWidth:850,padding:"1.5rem",paddingBottom:"7rem"}}><Link href={sent?"/applications":`/jobb/${jobId}`}>← Tillbaka</Link><h1>Det här delar du med företaget</h1><p>CV och praktiska uppgifter ingår. Välj relevanta extra uppgifter för just det här jobbet. Privata utkast och samtal delas inte. Saknad video eller okänd matchning stoppar inte ansökan.</p>
    {error&&<p role="alert">{error}</p>}{!preview?<><p role="status">Hämtar underlag…</p>{error&&<button onClick={()=>void load()}>Försök igen</button>}</>:<>
    <JobRequirementsInsight jobId={jobId!}/><ApplicationDisclosureView packet={preview.packet} youthPreview/>
    {preview.is_saved?<section><h2>Sparad delning</h2><p>Detta är samma underlag som företaget får för den här ansökan. Profiländringar delas först när du väljer att uppdatera underlaget.</p><button className="secondary-btn" disabled={busy} onClick={()=>void load([])}>Uppdatera från min profil och välj uppgifter</button></section>:<fieldset disabled={busy}><legend>Extra uppgifter att dela</legend>{preview.options.map(option=><label key={option.key} style={{display:"block",margin:"1rem 0"}}><input type="checkbox" checked={preview.selected_keys.includes(option.key)} onChange={event=>void load(event.target.checked?[...preview.selected_keys,option.key]:preview.selected_keys.filter(key=>key!==option.key))}/>{option.label}: {option.text}</label>)}</fieldset>}
    <details><summary>Vilka källuppgifter används i matchningen?</summary><p>Matchningen använder ditt granskade CV, sparade profilfakta och delade ansökningssvar. Rensning sker före AI-anrop. Företaget får inte hela jobbprofilen: belägg får bara visas från det delade underlaget ovan. Detta visar källuppgifter, inget individuellt AI-betyg.</p><pre style={{whiteSpace:"pre-wrap",fontFamily:"inherit"}}>{applicationSourceInput(preview.matching_input)}</pre></details>
    <p>Uppladdade CV delas som originalfiler. Öppna filen ovan och kontrollera kontaktuppgifter eller bostadsadress innan du skickar. En borttagen gammal CV-fil kan bli otillgänglig; en ny fil delas först när du uppdaterar underlaget.</p>
    <button className="cta-btn" disabled={busy} onClick={()=>void save(!sent)}>{busy?"Sparar…":sent?(preview.is_saved?"Till mina ansökningar":"Spara uppdaterad delning"):"Dela underlaget och skicka ansökan"}</button></>}
  </main>;
}
export default function Page(){return <Suspense fallback={<main className="mobile-shell"><p>Laddar…</p></main>}><Preview/></Suspense>;}
