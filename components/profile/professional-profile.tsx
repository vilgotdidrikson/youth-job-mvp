import type { ReactNode } from "react";

export function ProfileHeader({ name, location, completion, onEdit }: { name: string; location: string; completion: number; onEdit: () => void }) {
  return (
    <header className="network-profile-header">
      <div className="network-profile-cover" />
      <div className="network-profile-header-content">
        <div className="network-profile-avatar" aria-hidden="true">{(name.trim().charAt(0) || "?").toUpperCase()}</div>
        <div className="network-profile-identity">
          <h1>{name.trim() || "Din profil"}</h1>
          <p>Ung jobbsökande på Employo</p>
          <span>{location || "Sverige"} · Öppen för nya möjligheter</span>
        </div>
        <div className="network-profile-actions"><button type="button" onClick={onEdit}>Redigera profil</button><button type="button" aria-label="Fler profilalternativ">•••</button></div>
        <div className="network-profile-open"><strong>Profilens styrka: {completion}%</strong><span>Fyll i dina uppgifter för att bli lättare att hitta.</span></div>
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
