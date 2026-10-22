"use client";
import Link from "next/link";
import {useSession} from "@/hooks/use-session";
import {useCvCompletion} from "@/hooks/use-cv-completion";
import {useRecruitmentProfile} from "@/hooks/use-recruitment-profile";
import {completedProfileSections} from "@/lib/recruitment-profile";
import styles from "./recruitment-profile.module.css";
export function ProfileCompletionNotice(){
 const {user,profile}=useSession();
 const youth=profile?.role === "youth";
 const {cvCompleted,cvLoading}=useCvCompletion(user?.id,youth);
 const state=useRecruitmentProfile(youth?user?.id:undefined);
 if(!youth || state.loading || state.error || cvLoading) return null;
 const remaining=4-completedProfileSections(state.profile).length;
 if(cvCompleted && !remaining)return null;
 return <section className={styles.prompt}><div><strong>{cvCompleted ? "Du kan utveckla din profil" : "Ditt CV återstår"}</strong><p>{cvCompleted ? `${remaining} valfria profildelar saknar uppgifter. Lägg till mer när det passar dig.` : "Du kan upptäcka och spara jobb nu. Ett CV behövs innan ansökningarna skickas till företagen."}</p></div><Link href="/profile/build">Till profilbygget →</Link></section>;
}
