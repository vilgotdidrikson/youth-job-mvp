import type { ReactNode } from "react";

export function ProfileHeader({ name, location, completedSections, totalSections, onEdit }: { name: string; location: string; completedSections: number; totalSections: number; onEdit: () => void }) {
  return (
    <header className="network-profile-header">
      <div className="network-profile-cover" />
      <div className="network-profile-header-content">
        <div className="network-profile-avatar" aria-hidden="true">{(name.trim().charAt(0) || "?").toUpperCase()}</div>
        <div className="network-profile-identity">
          <h1>{name.trim() || "Din profil"}</h1>
          <p>Din profil på MatchnWork</p>
          <span>{location || "Sverige"} · Jobbsökande</span>
        </div>
        <div className="network-profile-actions"><button type="button" onClick={onEdit}>Redigera profil</button></div>
        <div className="network-profile-open"><strong>Fyllda profilavsnitt: {completedSections} av {totalSections}</strong><span>Ditt CV visas separat. Du kan lägga till fler uppgifter när du vill.</span></div>
      </div>
    </header>
  );
}

export function SidebarCard({ title, children }: { title: string; children: ReactNode }) {
  return <section className="network-sidebar-card"><h2>{title}</h2>{children}</section>;
}

export function ExperienceCard({ title, children }: { title: string; children: ReactNode }) {
  return <article className="network-entry"><div className="network-entry-mark" aria-hidden="true">E</div><div><h3>{title}</h3>{children}</div></article>;
}

export function SkillList({ skills }: { skills: string[] }) {
  return <div className="network-skill-list">{skills.length ? skills.map((skill) => <span key={skill}>{skill}</span>) : <span className="network-empty">Lägg till dina styrkor</span>}</div>;
}
