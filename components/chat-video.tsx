"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ModalDialog } from "./modal-dialog";
import { UiIcon } from "./ui-icon";
import { getProfileVideo, getVideo, revokeVideo, sendVideoMessage, uploadVideo, type YouthVideo } from "@/lib/video-client";
import { VideoPicker, type SelectedVideo } from "./video-picker";
import { VideoPlayer } from "./video-player";
import { ReportDialog } from "./report-dialog";
import type { ChatMessage } from "@/lib/types";
import styles from "./video.module.css";

export function ChatVideoComposer({conversationId,userId,onSent}:{conversationId:string;userId:string;onSent:()=>void}) {
  const [selected,setSelected]=useState<SelectedVideo|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const [phase,setPhase]=useState(''),[note,setNote]=useState("");
  const [open,setOpen]=useState(false);
  const controller=useRef<AbortController|null>(null),lock=useRef(false),pending=useRef<YouthVideo|null>(null);
  const messageId=useRef(crypto.randomUUID()),mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;controller.current?.abort();};},[]);
  const send=async(profile:boolean)=>{
    if(lock.current||(!profile&&!selected))return;lock.current=true;setBusy(true);setError("");setNote("");
    const abort=new AbortController();controller.current=abort;
    try{
      let video:YouthVideo|null=null;
      if(profile){if(!await getProfileVideo(userId))throw new Error("Spara en profilvideo i din profil först.");}
      else{setPhase("Laddar upp…");video=pending.current??await uploadVideo(selected!.file,selected!.duration,userId,conversationId,abort.signal);pending.current=video;}
      abort.signal.throwIfAborted();controller.current=null;setPhase("Skickar…");
      await sendVideoMessage(conversationId,userId,messageId.current,video);
      pending.current=null;messageId.current=crypto.randomUUID();
      if(mounted.current){setSelected(null);setNote("Videon är skickad.");onSent();}
    }catch(reason){if(mounted.current)setError(abort.signal.aborted?"Uppladdningen avbröts. Inget nytt videomeddelande skickades.":reason instanceof Error?reason.message:"Videon kunde inte skickas.");}
    finally{lock.current=false;controller.current=null;if(mounted.current){setBusy(false);setPhase('');}}
  };
  const discardPending=async()=>{
    if(!pending.current)return;setBusy(true);setError("");
    try{await revokeVideo(pending.current);pending.current=null;setSelected(null);messageId.current=crypto.randomUUID();setNote("Videon är otillgänglig. Om ett tidigare skickförsök nådde chatten går den videon inte längre att spela upp.");}
    catch{setError("Kunde inte återkalla videon. Försök igen.");}finally{setBusy(false);}
  };
  return <section className={styles.chatTools} aria-label="Video i chatten"><div className={styles.videoToolbar}>
    <Link href={`/video/record?conversation=${encodeURIComponent(conversationId)}`}><UiIcon name="camera" width="17"/>Spela in video</Link>
    <button type="button" disabled={busy} onClick={()=>setOpen(true)}><UiIcon name="upload" width="17"/>Välj video</button>
    <button type="button" disabled={busy||!!pending.current} onClick={()=>void send(true)}><UiIcon name="profile" width="17"/>Dela profilvideo</button>
    </div>
    {open&&<ModalDialog label="Skicka en video" busy={busy} onClose={()=>setOpen(false)} className={styles.videoDialog}><div className={styles.dialogHeading}><h2>Skicka en video</h2><button type="button" disabled={busy} className={styles.closeButton} aria-label="Stäng videoförhandsvisningen" onClick={()=>setOpen(false)}><UiIcon name="close"/></button></div>
    <VideoPicker value={selected} disabled={busy||!!pending.current} onChange={value=>{setSelected(value);setError("");setNote("");messageId.current=crypto.randomUUID();}}/>
    <div className={styles.actions}>{selected&&<button type="button" className="cta-btn" disabled={busy} onClick={()=>void send(false)}>{busy?phase:"Skicka vald video"}</button>}{controller.current&&phase==='Laddar upp…'&&<button className="secondary-btn" type="button" onClick={()=>controller.current?.abort()}>Avbryt uppladdning</button>}{pending.current&&!busy&&<button className="secondary-btn" type="button" onClick={()=>void discardPending()}>Återkalla video och välj annan</button>}</div>
    <p className={styles.hint}>Delas bara i den här chatten.</p>{busy&&<p role="status">{phase||"Förbereder delning…"}</p>}{error&&<p role="alert" className={styles.error}>{error}</p>}{note&&<p role="status">{note}</p>}</ModalDialog>}
    {!open&&error&&<p role="alert" className={styles.error}>{error}</p>}{!open&&note&&<p role="status">{note}</p>}
  </section>;
}

export function VideoMessage({message,own}:{message:ChatMessage;own:boolean}) {
  const [removed,setRemoved]=useState(false),[error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const remove=async()=>{
    if(!message.video_id||busy||!window.confirm("Ta bort videon från det här meddelandet? Meddelandet blir kvar men videon slutar vara tillgänglig."))return;
    setBusy(true);setError("");try{const video=await getVideo(message.video_id);if(video)await revokeVideo(video);setRemoved(true);}catch{setError("Kunde inte ta bort videon. Försök igen.");}finally{setBusy(false);}
  };
  return <div className={styles.videoMessage}>{removed?<p>Videon har tagits bort.</p>:message.video_kind==='profile'?<VideoPlayer userId={message.sender_user_id}/>:<VideoPlayer videoId={message.video_id??undefined} label="Videomeddelande"/>}
    <details className={styles.messageOptions}><summary aria-label="Alternativ för videomeddelandet">•••</summary><div>{own&&message.video_kind==='file'&&!removed&&<button className="secondary-btn" type="button" disabled={busy} onClick={()=>void remove()}>Ta bort video</button>}<ReportDialog targetType="message" targetId={message.id} label="Anmäl video"/></div></details>{error&&<p role="alert">{error}</p>}
  </div>;
}
