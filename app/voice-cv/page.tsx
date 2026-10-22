import { redirect } from "next/navigation";
import { VOICE_CV_ENABLED } from "@/lib/feature-flags";
import VoiceCvInterview from "@/components/voice-cv-interview";

export default function VoiceCvPage() {
  if (!VOICE_CV_ENABLED) redirect("/youth/cv");
  return <VoiceCvInterview />;
}
