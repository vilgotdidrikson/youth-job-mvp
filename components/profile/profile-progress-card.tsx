"use client";

interface ProfileProgressCardProps {
  completion: number;
  statusText: string;
  title: string;
  subtitle: string;
}

export function ProfileProgressCard({
  completion,
  statusText,
  title,
  subtitle,
}: ProfileProgressCardProps) {
  return (
    <section className="glass-card overflow-hidden">
      <div className="bg-gradient-to-br from-[#d9ecff] via-[#edf4ff] to-[#ffe9e0] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#44658d]">Profile Builder</p>
        <h1 className="mt-2 text-2xl font-semibold text-[#132742]">{title}</h1>
        <p className="mt-2 text-sm text-[#35597f]">{subtitle}</p>

        <div className="mt-4 flex items-center justify-between text-xs font-semibold text-[#2d5587]">
          <span>{statusText}</span>
          <span>{completion}%</span>
        </div>
        <div className="mt-1 h-2.5 rounded-full bg-white/75">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#1474ff] to-[#0a98ff] transition-all duration-300"
            style={{ width: `${completion}%` }}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={completion}
            aria-label="Profile completion"
          />
        </div>
      </div>
    </section>
  );
}
