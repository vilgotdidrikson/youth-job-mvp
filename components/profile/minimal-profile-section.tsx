import type { ReactNode } from "react";

interface MinimalProfileSectionProps {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}

export function MinimalProfileSection({
  id,
  eyebrow,
  title,
  description,
  children,
}: MinimalProfileSectionProps) {
  return (
    <section className="minimal-profile-section" id={id}>
      <header className="minimal-profile-section-intro">
        <p>{eyebrow}</p>
        <h2>{title}</h2>
        <span>{description}</span>
      </header>
      <div className="minimal-profile-section-content">{children}</div>
    </section>
  );
}
