"use client";

import { useEffect, useRef, useState } from "react";
import { getVideo, videoPlaybackUrl } from "@/lib/video-client";
import { UiIcon } from "./ui-icon";
import styles from "./video.module.css";

export function VideoPlayer({videoId,label="Videomeddelande"}:{videoId?:string;label?:string}) {
  const [url,setUrl]=useState(""),[error,setError]=useState(""),[loading,setLoading]=useState(false);
  const generation=useRef(0);
  useEffect(()=>{generation.current++;setUrl("");setError("");setLoading(false);
    // Sequence counter invalidates requests; it is intentionally read on cleanup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return()=>{generation.current++;};},[videoId]);
  const load=async()=>{
    const run=++generation.current;setLoading(true);setError("");setUrl("");
    try{const video=videoId?await getVideo(videoId):null;
      if(!video)throw new Error("Videon har tagits bort, saknas eller är inte tillgänglig för dig.");
      const src=await videoPlaybackUrl(video);if(run===generation.current)setUrl(src);
    }catch(reason){if(run===generation.current)setError(reason instanceof Error?reason.message:"Kunde inte spela upp videon.");}
    finally{if(run===generation.current)setLoading(false);}
  };
  return <div className={styles.player}>{!url&&<button type="button" className={styles.playCard} disabled={loading} onClick={()=>void load()}><span className={styles.playCircle}><UiIcon name="play" width="23"/></span><span>{loading?"Hämtar video…":label}<small>{loading?'Ett ögonblick':'Tryck för att spela upp'}</small></span></button>}
    {url&&<video key={url} className={styles.video} src={url} controls playsInline preload="metadata" aria-label={label} onError={()=>{setUrl("");setError("Videon kunde inte spelas upp. Förnya länken eller prova en annan webbläsare.");}}/>}
    {url&&<button type="button" className={styles.textButton} disabled={loading} onClick={()=>void load()}>Förnya uppspelning</button>}
    {error&&<p role="status">{error}</p>}
  </div>;
}
