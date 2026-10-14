"use client";

import { useEffect, useRef, useState } from "react";
import { PROFILE_VIDEO_POLICY } from "@/lib/profile-video";
import styles from "./video.module.css";

export function VideoRecorder({ onRecorded, disabled, onBusy }: { onRecorded: (file: File, duration: number) => void; disabled: boolean; onBusy?: (busy:boolean)=>void }) {
  const [state,setState] = useState<"idle"|"permission"|"recording">("idle");
  const [seconds,setSeconds] = useState(0), [error,setError] = useState("");
  const preview = useRef<HTMLVideoElement>(null), stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null), generation = useRef(0), interval = useRef<ReturnType<typeof setInterval> | null>(null);
  const discard = useRef(false), mounted = useRef(true);
  const stopTracks = () => { stream.current?.getTracks().forEach(track=>track.stop()); stream.current=null; };
  const clearTimer = () => { if(interval.current) clearInterval(interval.current); interval.current=null; };
  useEffect(()=>{ mounted.current=true;
    // A sequence counter, not a DOM ref: invalidate pending permission on cleanup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return ()=>{ mounted.current=false;generation.current++;discard.current=true;clearTimer();if(recorder.current?.state==='recording')recorder.current.stop();stopTracks(); }; },[]);
  useEffect(()=>{if(preview.current)preview.current.srcObject=stream.current;},[state]);
  const cancel = () => {
    onBusy?.(false);
    generation.current++;discard.current=true;clearTimer();
    if(recorder.current?.state==='recording')recorder.current.stop();
    stopTracks();setState("idle");setSeconds(0);
  };
  const start = async () => {
    if(disabled || state!=="idle")return;
    if(!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder==='undefined') {
      setError("Inspelning stöds inte i den här webbläsaren. Ladda upp en video i stället.");return;
    }
    const current=++generation.current;setState("permission");setError("");discard.current=false;onBusy?.(true);
    try {
      const media=await navigator.mediaDevices.getUserMedia({video:{facingMode:"user",width:{ideal:640},height:{ideal:480}},audio:true});
      if(current!==generation.current || !mounted.current){media.getTracks().forEach(track=>track.stop());return;}
      stream.current=media;
      const mime=["video/mp4","video/webm;codecs=vp8,opus","video/webm"].find(value=>MediaRecorder.isTypeSupported(value));
      if(!mime)throw new Error("Inget kompatibelt inspelningsformat. Ladda upp en video i stället.");
      const capture=new MediaRecorder(media,{mimeType:mime,videoBitsPerSecond:1500000,audioBitsPerSecond:64000});
      recorder.current=capture;
      const chunks:BlobPart[]=[];let bytes=0;const started=performance.now();
      capture.ondataavailable=event=>{
        if(event.data.size){chunks.push(event.data);bytes+=event.data.size;}
        if(bytes>PROFILE_VIDEO_POLICY.maxBytes){discard.current=true;setError("Inspelningen blev för stor. Prova en kortare video.");if(capture.state==='recording')capture.stop();}
      };
      capture.onerror=()=>{discard.current=true;clearTimer();stopTracks();if(!mounted.current||current!==generation.current)return;setError("Inspelningen avbröts. Försök igen eller ladda upp en fil.");setState("idle");onBusy?.(false);};
      capture.onstop=()=>{
        clearTimer();stopTracks();
        if(!mounted.current || current!==generation.current)return;
        setState("idle");
        onBusy?.(false);
        const duration=Math.min(60,(performance.now()-started)/1000);
        if(discard.current)return;
        const type=capture.mimeType.split(";")[0];
        const file=new File(chunks,`inspelning.${type==='video/mp4'?'mp4':'webm'}`,{type});
        onRecorded(file,duration);
      };
      capture.start(250);setSeconds(0);setState("recording");
      interval.current=setInterval(()=>{
        const elapsed=(performance.now()-started)/1000;setSeconds(Math.min(60,Math.floor(elapsed)));
        if(elapsed>=60 && capture.state==='recording')capture.stop();
      },200);
    } catch(reason) {
      stopTracks();if(current!==generation.current || !mounted.current)return;
      setState("idle");
      onBusy?.(false);
      setError(reason instanceof DOMException && reason.name==='NotAllowedError'
        ? "Kamera eller mikrofon nekades. Tillåt åtkomst i webbläsaren eller ladda upp en video."
        : reason instanceof Error ? reason.message : "Kunde inte starta inspelningen. Ladda upp en fil i stället.");
    }
  };
  return <div className={styles.recorder}>
    {state==='idle' ? <button type="button" className="secondary-btn" disabled={disabled} onClick={()=>void start()}>Spela in med kamera</button> : <>
      {state==='recording' && <video ref={preview} className={styles.video} autoPlay muted playsInline aria-label="Kameraförhandsvisning"/>}
      <p role="status">{state==='permission' ? "Väntar på kamera och mikrofon…" : `Spelar in: ${seconds} / 60 sekunder. Inspelningen publiceras inte automatiskt.`}</p>
      <div className={styles.actions}>{state==='recording' && <button className="cta-btn" type="button" onClick={()=>{if(recorder.current?.state==='recording')recorder.current.stop();}}>Stoppa och förhandsvisa</button>}<button className="secondary-btn" type="button" onClick={cancel}>Avbryt inspelning</button></div>
    </>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
