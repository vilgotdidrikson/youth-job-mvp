"use client";

import { useEffect, useRef, useState } from "react";
import { getVideo, videoPlaybackUrl } from "@/lib/video-client";
import { videoHasExpired, videoExpiryLabel } from "@/lib/video-retention";
import { UiIcon } from "./ui-icon";
import styles from "./video.module.css";

export function VideoPlayer({videoId,label="Videomeddelande"}:{videoId?:string;label?:string}) {
  const [url,setUrl]=useState(""),[error,setError]=useState(""),[loading,setLoading]=useState(false);
  const [expiresAt,setExpiresAt]=useState<string>(),[removed,setRemoved]=useState(false);
  const generation=useRef(0),source=useRef(""),element=useRef<HTMLVideoElement>(null);
  const clearPlayback=()=>{
    if(element.current){element.current.pause();element.current.removeAttribute("src");element.current.load();}
    if(source.current) URL.revokeObjectURL(source.current);
    source.current="";setUrl("");
  };
  useEffect(()=>{
    const run=++generation.current;clearPlayback();setError("");setLoading(false);setExpiresAt(undefined);setRemoved(false);
    if(videoId) void getVideo(videoId).then(video=>{
      if(run!==generation.current)return;
      setExpiresAt(video?.expires_at);
      setRemoved(!video||!!video.deleted_at||videoHasExpired(video.expires_at));
    }).catch(()=>{if(run===generation.current)setError("Kunde inte hämta videons information. Försök igen.");});
    else setRemoved(true);
    // The counter intentionally invalidates in-flight requests on cleanup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return()=>{generation.current++;if(source.current)URL.revokeObjectURL(source.current);source.current="";};
  },[videoId]);
  useEffect(()=>{
    if(!expiresAt)return;
    const expire=()=>{generation.current++;clearPlayback();setRemoved(true);setLoading(false);setError("");};
    const check=()=>{if(videoHasExpired(expiresAt))expire();};
    const timer=setTimeout(expire,Math.max(0,Date.parse(expiresAt)-Date.now()));
    // Catch background-tab suspension and clock changes when returning to the tab.
    window.addEventListener("focus",check);document.addEventListener("visibilitychange",check);
    return()=>{clearTimeout(timer);window.removeEventListener("focus",check);document.removeEventListener("visibilitychange",check);};
  },[expiresAt]);
  const load=async()=>{
    const run=++generation.current;setLoading(true);setError("");clearPlayback();
    try{
      const video=videoId?await getVideo(videoId):null;
      if(!video||video.deleted_at||videoHasExpired(video.expires_at)){
        if(run===generation.current)setRemoved(true);return;
      }
      if(run===generation.current)setExpiresAt(video.expires_at);
      const src=await videoPlaybackUrl(video);
      if(run===generation.current){source.current=src;setUrl(src);}else URL.revokeObjectURL(src);
    }catch(reason){if(run===generation.current)setError(reason instanceof Error?reason.message:"Kunde inte spela upp videon.");}
    finally{if(run===generation.current)setLoading(false);}
  };
  if(removed)return <p role="status">Videon är inte längre tillgänglig.</p>;
  return <div className={styles.player}>
    {expiresAt&&<p className={styles.hint}>Tillgänglig till <time dateTime={expiresAt}>{videoExpiryLabel(expiresAt)}</time></p>}
    {!url&&<button type="button" className={styles.playCard} disabled={loading} onClick={()=>void load()}><span className={styles.playCircle}><UiIcon name="play" width="23"/></span><span>{loading?"Hämtar video…":label}<small>{loading?'Ett ögonblick':'Tryck för att spela upp'}</small></span></button>}
    {url&&<video ref={element} key={url} className={styles.video} src={url} controls playsInline preload="metadata" aria-label={label} onError={()=>{clearPlayback();setError("Videon kunde inte spelas upp. Försök igen.");}}/>}
    {error&&<p role="status">{error}</p>}
  </div>;
}
