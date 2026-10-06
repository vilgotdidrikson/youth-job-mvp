"use client";

import {createContext,useContext,useEffect,useState,type ReactNode} from "react";
import {usePathname} from "next/navigation";
import {useSession} from "./use-session";
import {getSupabaseClient} from "@/lib/supabase";
import {subscribeVisibleRefresh} from "@/lib/visible-refresh";
import {supplementQuestions} from "@/lib/application-supplement";
import type {ApplicationCompletion,ApplicationFollowup} from "@/lib/application-completions";

const empty={questions:false,messages:false,notifications:false};
const IndicatorsContext=createContext(empty);
export const useNavigationIndicators=()=>useContext(IndicatorsContext);
export function NavigationIndicatorsProvider({children}:{children:ReactNode}) {
  const {user,profile}=useSession();
  const pathname=usePathname();
  const [state,setState]=useState({userId:"",...empty});
  const userId=user?.id, role=profile?.role;
  useEffect(()=>{
    if(!userId || !role) return;
    let active=true,busy=false;
    const client=getSupabaseClient();
    const refresh=async()=>{
      if(!active || busy || document.visibilityState!=="visible") return;
      busy=true;
      try {
        const [notifications,applications,followups]=await Promise.all([
          client.from("notifications").select("type").eq("user_id",userId).is("read_at",null).limit(1000),
          role === "youth" ? client.from("application_completions").select("job_id,status,questions,answers,omitted_question_ids").eq("youth_user_id",userId).eq("status","submitted") : Promise.resolve({data:[],error:null}),
          role === "youth" ? client.from("application_followups").select("job_id,status").eq("youth_user_id",userId).eq("status","pending") : Promise.resolve({data:[],error:null}),
        ]);
        if(notifications.error || applications.error || followups.error || !active) return;
        const pendingStatic=(applications.data ?? []).some(item=>supplementQuestions(item as unknown as ApplicationCompletion,[]).some(question=>question.status==="pending"));
        setState({userId,notifications:!!notifications.data?.length,messages:!!notifications.data?.some(item=>item.type==="message" || item.type==="match"),questions:pendingStatic || !!(followups.data as ApplicationFollowup[])?.length});
      } finally {busy=false;}
    };
    const run=()=>void refresh().catch(()=>{});
    run();
    const stop=subscribeVisibleRefresh(refresh);
    // Read-only, visible-page fallback: question generation can finish after a swipe.
    // No AI calls, hidden-page polling or background notifications are triggered here.
    const timer=window.setInterval(run,30000);
    window.addEventListener("mnw-navigation-refresh",run);
    return ()=>{active=false;stop();window.clearInterval(timer);window.removeEventListener("mnw-navigation-refresh",run);};
  },[userId,role,pathname]);
  return <IndicatorsContext.Provider value={state.userId===userId ? state : empty}>{children}</IndicatorsContext.Provider>;
}
