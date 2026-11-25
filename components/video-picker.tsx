"use client";

import { useEffect, useRef, useState } from "react";
import { validateProfileVideo } from "@/lib/profile-video";
import styles from "./video.module.css";

export interface SelectedVideo { file: File; duration: number }

export function VideoPreview({value}:{value:SelectedVideo}) {
  const preview=useRef<HTMLVideoElement>(null);
  useEffect(()=>{const src=URL.createObjectURL(value.file),element=preview.current;if(element)element.src=src;return()=>{if(element){element.removeAttribute('src');element.load();}URL.revokeObjectURL(src);};},[value.file]);
  return <div><video ref={preview} className={styles.video} controls playsInline preload="metadata" aria-label="Förhandsvisning av vald video"/><p className={styles.hint}>{Math.ceil(value.duration)} sekunder · {(value.file.size/1024/1024).toFixed(1)} MB</p></div>;
}

export function VideoPicker({value,onChange,disabled}:{value:SelectedVideo|null;onChange:(value:SelectedVideo|null)=>void;disabled:boolean}) {
  const [error,setError]=useState("");
  const generation=useRef(0), probe=useRef<HTMLVideoElement|null>(null);
  const [reading,setReading]=useState(false);
  useEffect(()=>()=>{generation.current++;if(probe.current){probe.current.removeAttribute('src');probe.current.load();}},[]);
  const accept=(file:File,duration:number)=>{
    const result=validateProfileVideo({name:file.name,type:file.type.split(';')[0],size:file.size,durationSeconds:duration});
    if(!result.ok){setError(result.message);onChange(null);}else{setError("");onChange({file,duration});}
  };
  const choose=async(file:File)=>{
    const run=++generation.current;setError("");setReading(true);onChange(null);
    const precheck=validateProfileVideo({name:file.name,type:file.type.split(';')[0],size:file.size,durationSeconds:1});
    if(!precheck.ok){setError(precheck.message);setReading(false);return;}
    const src=URL.createObjectURL(file),video=document.createElement('video');probe.current=video;
    try{
      const duration=await new Promise<number>((resolve,reject)=>{
        const timeout=setTimeout(()=>{cleanup();reject(new Error("Videon kunde inte läsas. Prova MP4 eller en annan fil."));},12000);
        const cleanup=()=>{clearTimeout(timeout);video.onloadedmetadata=null;video.ontimeupdate=null;video.onerror=null;};
        const finish=()=>{const duration=video.duration;if(Number.isFinite(duration)&&duration>0){cleanup();resolve(duration);}};
        video.onloadedmetadata=()=>{if(Number.isFinite(video.duration))finish();else{video.currentTime=1e10;}};
        video.ontimeupdate=finish;video.onerror=()=>{cleanup();reject(new Error("Videon går inte att spela upp i den här webbläsaren. Prova MP4."));};
        video.preload='metadata';video.src=src;
      });
      if(run===generation.current)accept(file,duration);
    }catch(reason){if(run===generation.current)setError(reason instanceof Error?reason.message:"Kunde inte läsa videon.");}
    finally{URL.revokeObjectURL(src);video.removeAttribute('src');video.load();if(run===generation.current)setReading(false);}
  };
  return <div>
    <label className={styles.picker}>Välj video<input type="file" accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov" disabled={disabled||reading} onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(file)void choose(file);}}/></label>
    <p className={styles.hint}>MP4, WebM eller MOV · högst 60 s / 30 MB</p>
    {reading&&<p role="status">Kontrollerar videon…</p>}
    {error&&<p role="alert" className={styles.error}>{error}</p>}
    {value&&<><VideoPreview value={value}/><button type="button" className="secondary-btn" disabled={disabled} onClick={()=>onChange(null)}>Välj annan video</button></>}
  </div>;
}
