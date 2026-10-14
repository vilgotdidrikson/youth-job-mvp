"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { AuthGateMessage } from "@/components/auth-gate-message";
import { VideoRecorder } from "@/components/video-recorder";
import { VideoPicker, VideoPreview, type SelectedVideo } from "@/components/video-picker";
import { UiIcon } from "@/components/ui-icon";
import { getSupabaseClient } from "@/lib/supabase";
import { getProfileVideo, replaceProfileVideo, sendVideoMessage, uploadVideo, type YouthVideo } from "@/lib/video-client";
import styles from "@/components/video.module.css";

function VideoStudio() {
  const {user,profile,status,error:sessionError}=useRequireAuth();
  const query=useSearchParams(),conversationId=query.get('conversation');
  const [mode,setMode]=useState<'record'|'upload'>(query.get('mode')==='upload'?'upload':'record');
  const [selected,setSelected]=useState<SelectedVideo|null>(null),[previous,setPrevious]=useState<YouthVideo|null>(null);
  const [ready,setReady]=useState(false),[cameraBusy,setCameraBusy]=useState(false),[phase,setPhase]=useState<'ready'|'uploading'|'saving'|'done'>('ready');
  const [error,setError]=useState(""),[cleanupNote,setCleanupNote]=useState("");
  const pending=useRef<YouthVideo|null>(null),controller=useRef<AbortController|null>(null),lock=useRef(false),mounted=useRef(true);
  const messageId=useRef(crypto.randomUUID());
  const back=conversationId?`/chats?conversation=${encodeURIComponent(conversationId)}`:'/profile';
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;controller.current?.abort();};},[]);
  useEffect(()=>{
    if(!user||profile?.role!=='youth')return;
    let active=true;setReady(false);
    void(async()=>{
      try{
        if(conversationId){const {data,error}=await getSupabaseClient().from('conversations').select('id').eq('id',conversationId).eq('youth_user_id',user.id).maybeSingle();if(error||!data)throw new Error('Du saknar åtkomst till den här chatten.');}
        else{const video=await getProfileVideo(user.id);if(active)setPrevious(video);}
        if(active){setReady(true);setError("");}
      }catch(reason){if(active)setError(reason instanceof Error?reason.message:'Kunde inte öppna videoflödet.');}
    })();return()=>{active=false;};
  },[user,profile?.role,conversationId]);
  const save=async()=>{
    if(!selected||!user||!ready||lock.current)return;
    lock.current=true;setError("");const abort=new AbortController();controller.current=abort;setPhase('uploading');
    try{
      const video=pending.current??await uploadVideo(selected.file,selected.duration,user.id,conversationId,abort.signal);
      pending.current=video;abort.signal.throwIfAborted();controller.current=null;
      if(mounted.current)setPhase('saving');
      if(conversationId)await sendVideoMessage(conversationId,user.id,messageId.current,video);
      else{const cleaned=await replaceProfileVideo(user.id,video,previous);if(!cleaned&&mounted.current)setCleanupNote('Din nya video är sparad. Den tidigare filen väntar på städning.');}
      pending.current=null;if(mounted.current)setPhase('done');
    }catch(reason){if(mounted.current){setPhase('ready');setError(abort.signal.aborted?'Uppladdningen avbröts. Försök när du är redo.':reason instanceof Error?reason.message:'Kunde inte spara videon.');}}
    finally{lock.current=false;controller.current=null;}
  };
  if(status!=='ready')return <AuthGateMessage status={status} error={sessionError}/>;
  if(!user||profile?.role!=='youth')return <main className={styles.studio}><h1>Videoinspelning</h1><p>Det här flödet är för ungdomens presentation.</p><Link href="/chats">Till chattarna</Link></main>;
  const busy=phase==='uploading'||phase==='saving';
  return <main className={styles.studio}>
    <Link className={styles.backLink} href={back}><UiIcon name="arrow" width="18"/>{conversationId?'Tillbaka till chatten':'Tillbaka till profilen'}</Link>
    <header className={styles.studioHeading}><span className={styles.eyebrow}>{conversationId?'ETT PERSONLIGT MEDDELANDE':'DIN PRESENTATION'}</span><h1>{phase==='done'?(conversationId?'Videon är skickad':'Din profilvideo är sparad'):selected?'Känns det som du?':conversationId?'Säg det med en video':'Visa lite mer av dig'}</h1><p>{phase==='done'?'Klart! Du kan gå tillbaka när du vill.':selected?'Titta och lyssna innan du väljer att dela.':'En kort video räcker. Du behöver inte säga allt perfekt.'}</p></header>
    <div className={`${styles.studioGrid} ${selected?styles.studioReview:""}`}><section className={styles.studioSurface} aria-label="Spela in eller välj video">
      {!ready&&!error&&<p role="status">Förbereder…</p>}
      {phase==='done'?<><span className={styles.successMark}><UiIcon name="check" width="28"/></span>{selected&&<VideoPreview value={selected}/>}<Link className="cta-btn" href={back}>{conversationId?'Till chatten':'Till min profil'}<UiIcon name="arrow" width="18"/></Link>{cleanupNote&&<p role="status">{cleanupNote}</p>}</>:<>
        {!selected&&<nav className={styles.modeTabs} aria-label="Välj videosätt"><button type="button" disabled={cameraBusy||busy} aria-pressed={mode==='record'} onClick={()=>setMode('record')}><UiIcon name="camera" width="18"/>Spela in</button><button type="button" disabled={cameraBusy||busy} aria-pressed={mode==='upload'} onClick={()=>setMode('upload')}><UiIcon name="upload" width="18"/>Välj video</button></nav>}
        {selected&&mode==='record'?<VideoPreview value={selected}/>:mode==='record'?<VideoRecorder disabled={!ready||busy} onBusy={setCameraBusy} onRecorded={(file,duration)=>setSelected({file,duration})}/>:<VideoPicker value={selected} disabled={!ready||busy||!!pending.current} onChange={setSelected}/>}
        {selected&&<div className={styles.studioActions}><button type="button" className="cta-btn" disabled={busy} onClick={()=>void save()}>{phase==='uploading'?'Laddar upp…':phase==='saving'?(conversationId?'Skickar…':'Sparar…'):(conversationId?'Skicka video':'Spara profilvideo')}</button>{!pending.current&&<button type="button" className="secondary-btn" disabled={busy} onClick={()=>setSelected(null)}>{mode==='record'?'Spela in igen':'Välj annan'}</button>}{phase==='uploading'&&<button type="button" className="secondary-btn" onClick={()=>controller.current?.abort()}>Avbryt uppladdning</button>}</div>}
        <p className={styles.studioFootnote}>{selected?(conversationId?'Bara den här chatten får videon.':'Publiceras först när du sparar.'):'Högst 60 sekunder · Du väljer när inspelningen startar'}</p>
      </>}
      {error&&<p className={styles.error} role="alert">{error}</p>}
    </section>{phase!=='done'&&!selected&&<aside className={styles.prompts}><span className={styles.eyebrow}>NÅGOT ATT UTGÅ FRÅN</span><h2>{conversationId?'Vad vill du berätta?':'Tre saker att säga'}</h2><ol>{(conversationId?['Börja med ett hej.','Berätta vad du vill fråga eller dela.','Avsluta med ett nästa steg.']:['Vem är du och vad gillar du att göra?','Vad är du bra på? Ge gärna ett exempel.','Vilket jobb vill du prova och varför?']).map((text,index)=><li key={text}><span>{String(index+1).padStart(2,'0')}</span><p>{text}</p></li>)}</ol><p className={styles.hint}>Titta mot kameran och prata som vanligt. 30–60 sekunder är lagom.</p></aside>}</div>
  </main>;
}
function StudioRouter(){const query=useSearchParams();return <VideoStudio key={query.toString()}/>;}
export default function VideoRecordPage(){return <Suspense fallback={<main className={styles.studio}><p role="status">Öppnar videostudion…</p></main>}><StudioRouter/></Suspense>;}
