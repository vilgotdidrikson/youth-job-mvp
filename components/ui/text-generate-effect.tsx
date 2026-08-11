"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface TextGenerateEffectProps {
  words: string;
  className?: string;
  wordClassName?: string;
}

export function TextGenerateEffect({ words, className, wordClassName }: TextGenerateEffectProps) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [visible, setVisible] = useState(false);
  const wordList = words.split(" ");

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Safety net: never leave the text permanently invisible if the
    // observer doesn't fire (e.g. the element is already on-screen on load
    // in a way some browsers don't report as an initial intersection).
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
    <span ref={ref} className={cn("text-generate", className)}>
      {wordList.map((word, index) => (
        <span
          key={`${word}-${index}`}
          className={cn("text-generate-word", visible && "text-generate-word-visible", wordClassName)}
          style={{ transitionDelay: `${index * 90}ms` }}
        >
          {word}&nbsp;
        </span>
      ))}
    </span>
  );
}
