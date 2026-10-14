"use client";

import { useEffect, useRef, useState } from "react";
import { getProfileVideo, getVideo, revokeVideo, sendVideoMessage, uploadVideo, type YouthVideo } from "@/lib/video-client";
import { VideoPicker, type SelectedVideo } from "./video-picker";
import { VideoPlayer } from "./video-player";
import { ReportDialog } from "./report-dialog";
import type { ChatMessage } from "@/lib/types";
import styles from "./video.module.css";

export function ChatVideoComposer({conversationId,userId,onSent}:{conversationId:string;userId:string;onSent:()=>void}) {
  const [selected,setSelected]=useState<SelectedVideo|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const [phase,setPhase]=useState(''),[note,setNote]=useState("");
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
  return <details className={styles.chatTools}><summary>Skicka video — frivilligt</summary>
    <p className={styles.hint}>Videon delas bara i den här chatten. Kontakten kan anmäla innehållet via meddelandet.</p>
    <button type="button" className="secondary-btn" disabled={busy||!!pending.current} onClick={()=>void send(true)}>Dela min aktuella profilvideo</button>
    <p className={styles.hint}>Profilvideodelningar visar din aktuella video. Om du ersätter eller tar bort den ändras även delningen. Separata videomeddelanden påverkas inte.</p>
    <VideoPicker value={selected} disabled={busy||!!pending.current} onChange={value=>{setSelected(value);setError("");setNote("");messageId.current=crypto.randomUUID();}}/>
    <div className={styles.actions}>{selected&&<button type="button" className="cta-btn" disabled={busy} onClick={()=>void send(false)}>{busy?phase:"Skicka vald video"}</button>}{controller.current&&phase==='Laddar upp…'&&<button className="secondary-btn" type="button" onClick={()=>controller.current?.abort()}>Avbryt uppladdning</button>}{pending.current&&!busy&&<button className="secondary-btn" type="button" onClick={()=>void discardPending()}>Återkalla video och välj annan</button>}</div>
    {busy&&<p role="status">{phase||"Förbereder delning…"}</p>}{error&&<p role="alert" className={styles.error}>{error}</p>}{note&&<p role="status">{note}</p>}
  </details>;
}

export function VideoMessage({message,own}:{message:ChatMessage;own:boolean}) {
  const [removed,setRemoved]=useState(false),[error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const remove=async()=>{
    if(!message.video_id||busy||!window.confirm("Ta bort videon från det här meddelandet? Meddelandet blir kvar men videon slutar vara tillgänglig."))return;
    setBusy(true);setError("");try{const video=await getVideo(message.video_id);if(video)await revokeVideo(video);setRemoved(true);}catch{setError("Kunde inte ta bort videon. Försök igen.");}finally{setBusy(false);}
  };
  return <div>{removed?<p>Videon har tagits bort.</p>:message.video_kind==='profile'?<><p className={styles.hint}>Delning av aktuell profilvideo</p><VideoPlayer userId={message.sender_user_id}/></>:<VideoPlayer videoId={message.video_id??undefined} label="Videomeddelande"/>}
    <div className={styles.actions}>{own&&message.video_kind==='file'&&!removed&&<button className="secondary-btn" type="button" disabled={busy} onClick={()=>void remove()}>Ta bort videomeddelandets video</button>}<ReportDialog targetType="message" targetId={message.id} label="Anmäl video"/></div>{error&&<p role="alert">{error}</p>}
  </div>;
}
