"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface RevealProps {
  children: React.ReactNode;
  className?: string;
}

export function Reveal({ children, className }: RevealProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const fallback = setTimeout(() => setVisible(true), 1200);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setVisible(true);
        clearTimeout(fallback);
        observer.disconnect();
      },
      { threshold: 0.2 },
    );

    observer.observe(node);
    return () => {
      clearTimeout(fallback);
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={ref} className={cn("reveal", visible && "reveal-visible", className)}>
      {children}
    </div>
  );
}
