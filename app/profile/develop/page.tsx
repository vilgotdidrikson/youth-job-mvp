import { Suspense } from "react";
import { RecruitmentProfileEditor } from "@/components/recruitment-profile-editor";

export default function ProfileDevelopmentPage() {
  return <Suspense fallback={<main className="mobile-shell"><p role="status">Hämtar din profil…</p></main>}><RecruitmentProfileEditor /></Suspense>;
}
