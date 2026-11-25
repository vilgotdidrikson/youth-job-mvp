"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { AuthGateMessage } from "@/components/auth-gate-message";
import { VideoRecorder } from "@/components/video-recorder";
import { VideoPicker, VideoPreview, type SelectedVideo } from "@/components/video-picker";
import { UiIcon } from "@/components/ui-icon";
import { TabList } from "@/components/tab-list";
import { tabPanelProps } from "@/lib/tab-keyboard";
import { readChatVideoAccess } from "@/lib/video-client";
import { createChatVideoTransfer, type VideoTransferState } from "@/lib/chat-video-transfer";
import { createLatestRead, type ReadState } from "@/lib/latest-read";
import styles from "@/components/video.module.css";

function VideoStudio() {
  const {user,profile,status,error:sessionError}=useRequireAuth();
  const query=useSearchParams(),conversationId=query.get('conversation');
  if(status!=="ready")return <AuthGateMessage status={status} error={sessionError}/>;
  if(!user||profile?.role!=="youth")return <main className={styles.studio}><h1>Videoinspelning</h1><p>Det här flödet är för ungdomens presentation.</p><Link href="/chats">Till chattarna</Link></main>;
  if(!conversationId)return <main className={styles.studio}><h1>Video delas i chatten</h1><p>Profilvideo används inte längre. Öppna en chatt för att spela in eller skicka en video.</p><Link className="cta-btn" href="/chats">Till chattarna</Link><Link className="secondary-btn" href="/profile/build">Fortsätt bygga profil</Link></main>;
  return <VideoStudioWorkspace key={JSON.stringify([user.id,query.toString()])} userId={user.id} conversationId={conversationId} initialMode={query.get('mode')==='upload'?'upload':'record'}/>;
}

function VideoStudioWorkspace({userId,conversationId,initialMode}:{userId:string;conversationId:string;initialMode:"record"|"upload"}) {
  const [mode,setMode]=useState(initialMode);
  const [selected,setSelected]=useState<SelectedVideo|null>(null),[cameraBusy,setCameraBusy]=useState(false),[done,setDone]=useState(false);
  const [access,setAccess]=useState<ReadState<boolean>>({status:"loading"}),[accessRetry,setAccessRetry]=useState(0);
  const [state,setState]=useState<VideoTransferState>({phase:"ready",hasPending:false,error:"",note:""});
  const transfer=useRef<ReturnType<typeof createChatVideoTransfer>|null>(null),mounted=useRef(false);
  const back=`/chats?conversation=${encodeURIComponent(conversationId)}`;
  useEffect(()=>{
    mounted.current=true;
    const current=createChatVideoTransfer(userId,conversationId,setState);transfer.current=current;
    return()=>{mounted.current=false;current.stop();if(transfer.current===current)transfer.current=null;};
  },[userId,conversationId]);
  useEffect(()=>{
    const reader=createLatestRead<boolean>({read:(_,signal)=>readChatVideoAccess(userId,conversationId,signal),update:setAccess,errorMessage:"Kunde inte öppna videoflödet för den här chatten. Försök igen."});
    void reader.load();return()=>reader.stop();
  },[userId,conversationId,accessRetry]);
  const ready=access.status==="ready"&&access.value;
  const phase=done?'done':state.phase==='sending'?'saving':state.phase;
  const error=state.error;
  const save=async()=>{
    if(!mounted.current||!ready||!selected||!transfer.current)return;
    if(await transfer.current.send(selected.file,selected.duration))if(mounted.current)setDone(true);
  };
  const discard=async()=>{
    if(!mounted.current||!transfer.current)return;
    if(await transfer.current.discard())if(mounted.current)setSelected(null);
  };
  const busy=state.phase!=="ready";
  return <main className={styles.studio}>
    <Link className={styles.backLink} href={back}><UiIcon name="arrow" width="18"/>Tillbaka till chatten</Link>
    <header className={styles.studioHeading}><span className={styles.eyebrow}>ETT PERSONLIGT MEDDELANDE</span><h1>{phase==='done'?'Videon är skickad':selected?'Känns det som du?':'Säg det med en video'}</h1><p>{phase==='done'?'Klart! Du kan gå tillbaka när du vill.':selected?'Titta och lyssna innan du väljer att dela.':'En kort video räcker. Du behöver inte säga allt perfekt.'}</p></header>
    <div className={`${styles.studioGrid} ${selected?styles.studioReview:""}`}><section className={styles.studioSurface} aria-label="Spela in eller välj video">
      {access.status==="loading"&&<p role="status">Förbereder…</p>}
      {access.status==="error"&&<div><p role="alert">{access.message}</p><button type="button" className="secondary-btn" onClick={()=>setAccessRetry(current=>current+1)}>Försök igen</button></div>}
      {phase==='done'?<><span className={styles.successMark}><UiIcon name="check" width="28"/></span>{selected&&<VideoPreview value={selected}/>}<Link className="cta-btn" href={back}>Till chatten<UiIcon name="arrow" width="18"/></Link></>:<>
        {!selected&&<TabList id="video-mode" label="Välj videosätt" className={styles.modeTabs} items={[{value:'record',label:<><UiIcon name="camera" width="18"/>Spela in</>,disabled:cameraBusy||busy},{value:'upload',label:<><UiIcon name="upload" width="18"/>Välj video</>,disabled:cameraBusy||busy}]} value={mode} onChange={setMode}/>}
        <div {...(selected?{}:tabPanelProps('video-mode',mode))}>{selected&&mode==='record'?<VideoPreview value={selected}/>:mode==='record'?<VideoRecorder disabled={!ready||busy} onBusy={setCameraBusy} onRecorded={(file,duration)=>setSelected({file,duration})}/>:<VideoPicker value={selected} disabled={!ready||busy||state.hasPending} onChange={setSelected}/>}</div>
        {selected&&<div className={styles.studioActions}><button type="button" className="cta-btn" disabled={!ready||busy} onClick={()=>void save()}>{phase==='uploading'?'Laddar upp…':phase==='saving'?'Skickar…':phase==='revoking'?'Återkallar…':'Skicka video'}</button>{!state.hasPending&&<button type="button" className="secondary-btn" disabled={busy} onClick={()=>setSelected(null)}>{mode==='record'?'Spela in igen':'Välj annan'}</button>}{state.hasPending&&!busy&&<button type="button" className="secondary-btn" onClick={()=>void discard()}>Återkalla video och välj annan</button>}{phase==='uploading'&&<button type="button" className="secondary-btn" onClick={()=>transfer.current?.cancelUpload()}>Avbryt uppladdning</button>}</div>}
        <p className={styles.studioFootnote}>{selected?'Bara den här chatten får videon. Tillgänglig i 14 dagar efter skickandet; mottagaren kan hinna missa den.':'Högst 60 sekunder · Du väljer när inspelningen startar'}</p>
      </>}
      {state.note&&!done&&<p role="status">{state.note}</p>}
      {error&&<p className={styles.error} role="alert">{error}</p>}
    </section>{phase!=='done'&&!selected&&<aside className={styles.prompts}><span className={styles.eyebrow}>NÅGOT ATT UTGÅ FRÅN</span><h2>Vad vill du berätta?</h2><ol>{['Börja med ett hej.','Berätta vad du vill fråga eller dela.','Avsluta med ett nästa steg.'].map((text,index)=><li key={text}><span>{String(index+1).padStart(2,'0')}</span><p>{text}</p></li>)}</ol><p className={styles.hint}>Titta mot kameran och prata som vanligt. 30–60 sekunder är lagom.</p></aside>}</div>
  </main>;
}
export default function VideoRecordPage(){return <Suspense fallback={<main className={styles.studio}><p role="status">Öppnar videostudion…</p></main>}><VideoStudio/></Suspense>;}
