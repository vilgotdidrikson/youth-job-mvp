"use client";
import { useCallback, useRef, useState } from "react";
import type { JobPost } from "@/lib/types";

/** A late response may never replace a more recent choice (or a new feed). */
export function useDiscoveryUndo() {
  const sequence = useRef(0);
  const [lastSkip, setLastSkip] = useState<{ job: JobPost; token: string } | null>(null);
  const clear = useCallback(() => { sequence.current++; setLastSkip(null); }, []);
  const begin = () => {
    const attempt = ++sequence.current;
    setLastSkip(null);
    return (job: JobPost, token: string) => {
      if (attempt === sequence.current) setLastSkip({ job, token });
    };
  };
  return { lastSkip, begin, clear };
}
