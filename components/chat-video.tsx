"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ModalDialog } from "./modal-dialog";
import { UiIcon } from "./ui-icon";
import { getVideo, revokeVideo } from "@/lib/video-client";
import { createChatVideoTransfer, type VideoTransferState } from "@/lib/chat-video-transfer";
import { VideoPicker, type SelectedVideo } from "./video-picker";
import { VideoPlayer } from "./video-player";
import { ReportDialog } from "./report-dialog";
import type { ChatMessage } from "@/lib/types";
import styles from "./video.module.css";

export function ChatVideoComposer(props:{conversationId:string;userId:string;onSent:()=>void}) {
  return <ChatVideoWorkspace key={JSON.stringify([props.userId,props.conversationId])} {...props}/>;
}

function ChatVideoWorkspace({conversationId,userId,onSent}:{conversationId:string;userId:string;onSent:()=>void}) {
  const [selected,setSelected]=useState<SelectedVideo|null>(null);
  const [state,setState]=useState<VideoTransferState>({phase:"ready",hasPending:false,error:"",note:""});
  const [open,setOpen]=useState(false);
  const transfer=useRef<ReturnType<typeof createChatVideoTransfer>|null>(null),mounted=useRef(false);
  useEffect(()=>{
    mounted.current=true;
    const current=createChatVideoTransfer(userId,conversationId,setState);transfer.current=current;
    return()=>{mounted.current=false;current.stop();if(transfer.current===current)transfer.current=null;};
  },[userId,conversationId]);
  const busy=state.phase!=="ready",error=state.error,note=state.note;
  const phase=state.phase==="uploading"?"Laddar upp…":state.phase==="revoking"?"Återkallar…":"Skickar…";
  const send=async()=>{
    if(!mounted.current||!selected||!transfer.current)return;
    if(await transfer.current.send(selected.file,selected.duration)){
      if(mounted.current){setSelected(null);onSent();}
    }
  };
  const discardPending=async()=>{
    if(!mounted.current||!transfer.current)return;
    if(await transfer.current.discard())if(mounted.current)setSelected(null);
  };
  return <section className={styles.chatTools} aria-label="Video i chatten"><div className={styles.videoToolbar}>
    <Link href={`/video/record?conversation=${encodeURIComponent(conversationId)}`}><UiIcon name="camera" width="17"/>Spela in video</Link>
    <button type="button" disabled={busy} onClick={()=>setOpen(true)}><UiIcon name="upload" width="17"/>Välj video</button>
    </div>
    {open&&<ModalDialog label="Skicka en video" busy={busy} onClose={()=>setOpen(false)} className={styles.videoDialog}><div className={styles.dialogHeading}><h2>Skicka en video</h2><button type="button" disabled={busy} className={styles.closeButton} aria-label="Stäng videoförhandsvisningen" onClick={()=>setOpen(false)}><UiIcon name="close"/></button></div>
    <VideoPicker value={selected} disabled={busy||state.hasPending} onChange={value=>{if(!busy&&!state.hasPending){setSelected(value);setState(current=>({...current,error:"",note:""}));}}}/>
    <div className={styles.actions}>{selected&&<button type="button" className="cta-btn" disabled={busy} onClick={()=>void send()}>{busy?phase:"Skicka vald video"}</button>}{state.phase==="uploading"&&<button className="secondary-btn" type="button" onClick={()=>transfer.current?.cancelUpload()}>Avbryt uppladdning</button>}{state.hasPending&&!busy&&<button className="secondary-btn" type="button" onClick={()=>void discardPending()}>Återkalla video och välj annan</button>}</div>
    <p className={styles.hint}>Delas bara i den här chatten och är tillgänglig i 14 dagar efter att den skickats. Mottagaren kan hinna missa den.</p>{busy&&<p role="status">{phase||"Förbereder delning…"}</p>}{error&&<p role="alert" className={styles.error}>{error}</p>}{note&&<p role="status">{note}</p>}</ModalDialog>}
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
  return <div className={styles.videoMessage}>{removed?<p>Videon har tagits bort från chatten.</p>:message.video_kind==='profile'?<p>Profilvideo används inte längre. Be om en ny video i chatten om du vill.</p>:<VideoPlayer videoId={message.video_id??undefined} label="Videomeddelande"/>}
    <details className={styles.messageOptions}><summary aria-label="Alternativ för videomeddelandet">•••</summary><div>{own&&message.video_kind==='file'&&!removed&&<button className="secondary-btn" type="button" disabled={busy} onClick={()=>void remove()}>Ta bort video</button>}<ReportDialog targetType="message" targetId={message.id} label="Anmäl video"/></div></details>{error&&<p role="alert">{error}</p>}
  </div>;
}
