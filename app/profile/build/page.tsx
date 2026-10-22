import { Suspense } from "react";
import { ProfileBuilder } from "@/components/profile-builder";
export default function Page(){return <Suspense fallback={<main><p role="status">Hämtar profilbygget…</p></main>}><ProfileBuilder/></Suspense>;}
