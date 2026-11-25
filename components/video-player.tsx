"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getVideo, videoPlaybackUrl } from "@/lib/video-client";
import { videoHasExpired, videoExpiryLabel } from "@/lib/video-retention";
import { createLatestRead } from "@/lib/latest-read";
import { UiIcon } from "./ui-icon";
import styles from "./video.module.css";

export function VideoPlayer({videoId,label="Videomeddelande"}:{videoId?:string;label?:string}) {
  return <VideoPlayerWorkspace key={videoId??""} videoId={videoId} label={label}/>;
}

function VideoPlayerWorkspace({videoId,label}:{videoId?:string;label:string}) {
  const [url,setUrl]=useState(""),[error,setError]=useState(""),[loading,setLoading]=useState(false);
  const [expiresAt,setExpiresAt]=useState<string>(),[removed,setRemoved]=useState(false);
  const reader=useRef<ReturnType<typeof createLatestRead<void, boolean>>|null>(null),inFlight=useRef(false);
  const source=useRef(""),element=useRef<HTMLVideoElement>(null);
  const releasePlayback=useCallback(()=>{
    if(element.current){element.current.pause();element.current.removeAttribute("src");element.current.load();}
    if(source.current) URL.revokeObjectURL(source.current);
    source.current="";
  },[]);
  const clearPlayback=useCallback(()=>{releasePlayback();setUrl("");},[releasePlayback]);
  useEffect(()=>{
    const current=createLatestRead<void, boolean>({
      timeoutMs:45_000,
      errorMessage:"Kunde inte hämta videon. Försök igen.",
      update:state=>{
        inFlight.current=state.status==="loading";
        setLoading(inFlight.current);
        if(state.status==="loading"){clearPlayback();setError("");}
        if(state.status==="error")setError(state.message);
      },
      read:async(play,signal)=>{
        const video=videoId?await getVideo(videoId,signal):null;
        signal.throwIfAborted();
        setExpiresAt(video?.expires_at);
        const unavailable=!video||!!video.deleted_at||videoHasExpired(video.expires_at);
        setRemoved(unavailable);
        if(!play||unavailable||!video)return;
        const src=await videoPlaybackUrl(video,signal);
        // Release late resources even when a transport ignores cancellation.
        if(signal.aborted){URL.revokeObjectURL(src);signal.throwIfAborted();}
        source.current=src;setUrl(src);
      },
    });
    reader.current=current;
    void current.load(false);
    // The reader owns this video ID and invalidates requests on cleanup.
    return()=>{
      current.stop();if(reader.current===current)reader.current=null;
      releasePlayback();
    };
  },[videoId,clearPlayback,releasePlayback]);
  useEffect(()=>{
    if(!expiresAt)return;
    const expire=()=>{reader.current?.stop();inFlight.current=false;clearPlayback();setRemoved(true);setLoading(false);setError("");};
    const check=()=>{if(videoHasExpired(expiresAt))expire();};
    const timer=setTimeout(expire,Math.max(0,Date.parse(expiresAt)-Date.now()));
    // Catch background-tab suspension and clock changes when returning to the tab.
    window.addEventListener("focus",check);document.addEventListener("visibilitychange",check);
    return()=>{clearTimeout(timer);window.removeEventListener("focus",check);document.removeEventListener("visibilitychange",check);};
  },[expiresAt,clearPlayback]);
  const load=()=>{
    if(inFlight.current)return;
    void reader.current?.load(true);
  };
  if(removed)return <p role="status">Videon är inte längre tillgänglig.</p>;
  return <div className={styles.player}>
    {expiresAt&&<p className={styles.hint}>Tillgänglig till <time dateTime={expiresAt}>{videoExpiryLabel(expiresAt)}</time></p>}
    {!url&&<button type="button" className={styles.playCard} disabled={loading} onClick={()=>void load()}><span className={styles.playCircle}><UiIcon name="play" width="23"/></span><span>{loading?"Hämtar video…":label}<small>{loading?'Ett ögonblick':'Tryck för att spela upp'}</small></span></button>}
    {url&&<video ref={element} key={url} className={styles.video} src={url} controls playsInline preload="metadata" aria-label={label} onError={()=>{clearPlayback();setError("Videon kunde inte spelas upp. Försök igen.");}}/>}
    {error&&<p role="status">{error}</p>}
  </div>;
}
