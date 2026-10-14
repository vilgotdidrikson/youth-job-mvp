"use client";

import { useEffect, useRef, useState } from "react";
import { getProfileVideo, replaceProfileVideo, uploadVideo, type YouthVideo } from "@/lib/video-client";
import { VideoPicker, type SelectedVideo } from "./video-picker";
import { VideoPlayer } from "./video-player";
import styles from "./video.module.css";

export function ProfileVideo({userId}:{userId:string}) {
  const [video,setVideo]=useState<YouthVideo|null>(null),[selected,setSelected]=useState<SelectedVideo|null>(null);
  const [phase,setPhase]=useState<'loading'|'ready'|'uploading'|'saving'>('loading'),[error,setError]=useState(""),[note,setNote]=useState("");
  const controller=useRef<AbortController|null>(null),lock=useRef(false),pending=useRef<YouthVideo|null>(null);
  const [retry,setRetry]=useState(0);
  useEffect(()=>{let active=true;setPhase('loading');void getProfileVideo(userId).then(data=>{if(active){setVideo(data);setError("");setPhase('ready');}}).catch(()=>{if(active){setError("Profilvideon kunde inte hämtas. Försök igen innan du ändrar den.");setPhase('loading');}});return()=>{active=false;controller.current?.abort();};},[userId,retry]);
  const save=async()=>{
    if(!selected||lock.current||phase!=='ready')return;lock.current=true;setError("");setNote("");
    const abort=new AbortController();controller.current=abort;
    try {
      setPhase('uploading');
      const uploaded=pending.current??await uploadVideo(selected.file,selected.duration,userId,null,abort.signal);
      pending.current=uploaded;abort.signal.throwIfAborted();
      controller.current=null;setPhase('saving');
      const cleaned=await replaceProfileVideo(userId,uploaded,video);
      setVideo(uploaded);pending.current=null;setSelected(null);
      setNote(cleaned?"Din presentationsvideo är sparad.":"Videon är sparad. Den gamla videon är otillgänglig; filstädning kan behöva försökas igen.");
    }catch(reason){setError(abort.signal.aborted?"Uppladdningen avbröts. Din tidigare profilvideo är kvar.":reason instanceof Error?reason.message:"Videon kunde inte sparas.");}
    finally{lock.current=false;controller.current=null;setPhase('ready');}
  };
  const remove=async()=>{
    if(!video||lock.current||!window.confirm("Ta bort din presentationsvideo? Delningar av profilvideon blir också otillgängliga."))return;
    lock.current=true;setPhase('saving');setError("");setNote("");
    try{const cleaned=await replaceProfileVideo(userId,null,video);setVideo(null);setNote(cleaned?"Profilvideon har tagits bort.":"Videodelningen är avstängd. Den gamla filen kan behöva städas bort senare.");}
    catch(reason){setError(reason instanceof Error?reason.message:"Kunde inte ta bort videon.");}
    finally{lock.current=false;setPhase('ready');}
  };
  const busy=phase!=='ready';
  return <section className={styles.card} aria-label="Din presentationsvideo"><h2>Presentationsvideo <small>— frivilligt</small></h2>
    <p>Berätta vem du är, vad du gillar att göra och varför du vill jobba. Du kan söka jobb utan video. Ingen automatisk personlighetsanalys görs.</p>
    <p className={styles.hint}>Videon lagras privat. Företag som har fått din ansökan kan se den. Du kan också dela den i en matchad chatt. Delningar av profilvideon följer din aktuella video och slutar fungera när du tar bort den. Redan utfärdade uppspelningslänkar kan fungera i högst fem minuter.</p>
    {phase==='loading'&&<><p role="status">{error?"Videon kunde inte läsas.":"Hämtar din profilvideo…"}</p>{error&&<button className="secondary-btn" type="button" onClick={()=>setRetry(n=>n+1)}>Försök igen</button>}</>}
    {video&&<><VideoPlayer key={video.id} videoId={video.id}/><div className={styles.actions}><button type="button" className="secondary-btn" disabled={busy} onClick={()=>void remove()}>Ta bort profilvideo</button></div></>}
    <VideoPicker value={selected} disabled={busy||!!pending.current} onChange={value=>{setSelected(value);setError("");setNote("");}}/>
    {selected&&<div className={styles.actions}><button className="cta-btn" type="button" disabled={busy} onClick={()=>void save()}>{phase==='uploading'?"Laddar upp…":phase==='saving'?"Sparar…":video?"Ersätt profilvideo":"Spara profilvideo"}</button>{phase==='uploading'&&<button className="secondary-btn" type="button" onClick={()=>controller.current?.abort()}>Avbryt uppladdning</button>}</div>}
    {error&&<p role="alert" className={styles.error}>{error}</p>}{note&&<p role="status">{note}</p>}
  </section>;
}
