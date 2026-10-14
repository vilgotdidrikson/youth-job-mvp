"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getProfileVideo, replaceProfileVideo, type YouthVideo } from "@/lib/video-client";
import { VideoPlayer } from "./video-player";
import { UiIcon } from "./ui-icon";
import styles from "./video.module.css";

export function ProfileVideo({userId,onBusyChange}:{userId:string;onBusyChange?:(value:boolean)=>void}) {
  const [video,setVideo]=useState<YouthVideo|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
  const [error,setError]=useState(""),[note,setNote]=useState(""),[retry,setRetry]=useState(0);
  useEffect(()=>{let active=true;setLoading(true);void getProfileVideo(userId).then(data=>{if(active){setVideo(data);setError("");setLoading(false);}}).catch(()=>{if(active){setError("Kunde inte hämta videon.");setLoading(false);}});return()=>{active=false;};},[userId,retry]);
  const remove=async()=>{
    if(!video||busy||!window.confirm("Ta bort din profilvideo? Delningar av profilvideon blir också otillgängliga."))return;
    setBusy(true);onBusyChange?.(true);setError("");setNote("");
    try{const cleaned=await replaceProfileVideo(userId,null,video);setVideo(null);setNote(cleaned?"Profilvideon har tagits bort.":"Videon är avstängd. Filen väntar på städning.");}
    catch{setError("Kunde inte ta bort videon. Försök igen.");}finally{setBusy(false);onBusyChange?.(false);}
  };
  return <section className={styles.card} aria-label="Din presentationsvideo">
    <div className={styles.cardHeading}><span className={styles.iconTile}><UiIcon name="camera"/></span><div><h2>En kort presentation</h2><p className={styles.hint}>Låt arbetsgivaren lära känna dig. Helt frivilligt.</p></div>{video&&<span className={styles.savedBadge}>Sparad</span>}</div>
    {loading?<p role="status">Hämtar video…</p>:<>{video&&<VideoPlayer key={video.id} videoId={video.id}/>}<div className={styles.actions}><Link className="cta-btn" href="/video/record"><UiIcon name="camera" width="18"/>{video?'Spela in en ny':'Spela in profilvideo'}</Link><Link className="secondary-btn" href="/video/record?mode=upload"><UiIcon name="upload" width="18"/>Välj video</Link>{video&&<button type="button" className={styles.textButton} disabled={busy} onClick={()=>void remove()}>Ta bort</button>}</div></>}
    <details className={styles.moreInfo}><summary>Vem kan se videon?</summary><p>Företag som fått din ansökan och kontakter du delar den med. Byter eller tar du bort profilvideon ändras även delningarna. En befintlig uppspelningslänk gäller i högst fem minuter.</p></details>
    {error&&<p role="alert" className={styles.error}>{error} <button className={styles.textButton} type="button" onClick={()=>setRetry(n=>n+1)}>Försök igen</button></p>}{note&&<p role="status">{note}</p>}
  </section>;
}
