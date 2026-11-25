"use client";

import Link from "next/link";
import { UiIcon } from "@/components/ui-icon";
import { useSession } from "@/hooks/use-session";

/** The privacy page is public: only signed-in visitors get the way back to their profile (DA-09). */
export function PrivacyProfileLink() {
  const { user, loading } = useSession();
  if (loading || !user) return null;
  return <Link href="/profile">Tillbaka till profilen <UiIcon name="arrow" width="16" /></Link>;
}
