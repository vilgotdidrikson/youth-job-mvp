"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {useSession} from "@/hooks/use-session";
import {useCvCompletion} from "@/hooks/use-cv-completion";
import {useRecruitmentProfile} from "@/hooks/use-recruitment-profile";
import {completedProfileSections} from "@/lib/recruitment-profile";
import {countPendingInterests} from "@/lib/youth-activity";
import {pendingInterestReminder} from "@/lib/application-overview";
import styles from "./recruitment-profile.module.css";
export function ProfileCompletionNotice(){
 const {user,profile}=useSession();
 const youth=profile?.role === "youth";
 const {cvCompleted,cvLoading}=useCvCompletion(user?.id,youth);
 const state=useRecruitmentProfile(youth?user?.id:undefined);
 const userId=youth && !cvLoading && !cvCompleted ? user?.id : undefined;
 const [pending,setPending]=useState<{owner:string;count:number}>({owner:"",count:0});
 useEffect(()=>{
  if(!userId) return;
  let active=true;
  // Optional reminder: a failed read only hides the count.
  void countPendingInterests(userId).then(count=>{if(active)setPending({owner:userId,count});}).catch(()=>{});
  return ()=>{active=false;};
 },[userId]);
 const pendingCount=pending.owner===userId ? pending.count : 0;
 if(!youth || state.loading || state.error || cvLoading) return null;
 const remaining=4-completedProfileSections(state.profile).length;
 if(cvCompleted && !remaining)return null;
 return <section className={styles.prompt}><div><strong>{cvCompleted ? "Du kan utveckla din profil" : "Ditt CV återstår"}</strong><p>{cvCompleted ? `${remaining} valfria profildelar saknar uppgifter. Lägg till mer när det passar dig.` : pendingInterestReminder(pendingCount)}</p></div><Link href="/profile/build">Till profilbygget →</Link></section>;
}
