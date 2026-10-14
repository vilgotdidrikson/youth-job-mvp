"use client";

import { useEffect, useRef, useState } from "react";
import { getProfileVideo, getVideo, videoPlaybackUrl } from "@/lib/video-client";
import styles from "./video.module.css";

export function VideoPlayer({userId,videoId,label="Presentationsvideo"}:{userId?:string;videoId?:string;label?:string}) {
  const [url,setUrl]=useState(""),[error,setError]=useState(""),[loading,setLoading]=useState(false);
  const generation=useRef(0);
  useEffect(()=>{generation.current++;setUrl("");setError("");setLoading(false);
    // Sequence counter invalidates requests; it is intentionally read on cleanup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return()=>{generation.current++;};},[userId,videoId]);
  const load=async()=>{
    const run=++generation.current;setLoading(true);setError("");setUrl("");
    try{const video=videoId?await getVideo(videoId):userId?await getProfileVideo(userId):null;
      if(!video)throw new Error("Videon har tagits bort, saknas eller är inte tillgänglig för dig.");
      const src=await videoPlaybackUrl(video);if(run===generation.current)setUrl(src);
    }catch(reason){if(run===generation.current)setError(reason instanceof Error?reason.message:"Kunde inte spela upp videon.");}
    finally{if(run===generation.current)setLoading(false);}
  };
  return <div className={styles.player}><button type="button" className="secondary-btn" disabled={loading} onClick={()=>void load()}>{loading?"Hämtar video…":url?"Förnya uppspelningslänk":`Visa ${label.toLowerCase()}`}</button>
    {url&&<video key={url} className={styles.video} src={url} controls playsInline preload="metadata" aria-label={label} onError={()=>{setUrl("");setError("Videon kunde inte spelas upp. Förnya länken eller prova en annan webbläsare.");}}/>}
    {error&&<p role="status">{error}</p>}
  </div>;
}
