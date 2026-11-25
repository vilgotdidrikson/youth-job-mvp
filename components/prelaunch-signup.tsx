"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import type { Audience } from "@/lib/prelaunch";

export function PrelaunchSignup() {
  const [formRole, setFormRole] = useState<Audience>("youth");
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [error, setError] = useState("");
  function chooseForm(next: Audience) { setFormRole(next); setStatus("idle"); setError(""); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (status === "sending") return;
    const form = new FormData(event.currentTarget);
    setStatus("sending"); setError("");
    try {
      const response = await fetch("/api/prelaunch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: formRole, name: form.get("name"), email: form.get("email"), companyName: form.get("companyName"), consent: form.get("consent") === "on", website: form.get("website") }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Kunde inte spara din anmälan.");
      setStatus("success");
    } catch (err) { setError(err instanceof Error ? err.message : "Kunde inte ansluta. Försök igen."); setStatus("error"); }
  }
  return <div className="pl-form-card">{status === "success" ? <div className="pl-success" role="status"><span>✓</span><h2>Du är med på listan.</h2><p>Tack för ditt intresse! Vi hör av oss via e-post när MatchnWork öppnar, eller om vi vill bjuda in dig till en pilot.</p><p className="pl-small">Din anmälan är sparad. Du behöver inte skapa något konto.</p><button className="pl-text-button" onClick={() => setStatus("idle")}>Anmäl en till person →</button></div> : <><span className="pl-eyebrow">VAR MED FRÅN START</span><h1>Vi hör av oss<br />när det är <em>dags.</em></h1><p className="pl-form-intro">Skriv upp dig för ett mejl när MatchnWork öppnar.</p><div className="pl-switch" aria-label="Vem vill anmäla intresse?"><button type="button" aria-pressed={formRole === "youth"} onClick={() => chooseForm("youth")}>Jag söker jobb</button><button type="button" aria-pressed={formRole === "company"} onClick={() => chooseForm("company")}>Vi söker personal</button></div><form onSubmit={submit}>{formRole === "company" && <label>Företagsnamn<input name="companyName" placeholder="Vad heter ert företag?" autoComplete="organization" minLength={2} maxLength={150} required /></label>}<label>{formRole === "company" ? "Kontaktperson" : "Ditt namn"}<input name="name" placeholder={formRole === "company" ? "För- och efternamn" : "Vad heter du?"} autoComplete="name" minLength={2} maxLength={100} required /></label><label>E-post<input name="email" type="email" placeholder="namn@exempel.se" autoComplete="email" maxLength={254} required /></label><div className="pl-honeypot" aria-hidden="true"><label>Webbplats<input name="website" tabIndex={-1} autoComplete="off" /></label></div><label className="pl-consent"><input name="consent" type="checkbox" required /><span>Jag vill få mejl om lanseringen och eventuell pilot. Jag har läst <Link href="/launch-privacy">hur mina uppgifter används</Link> och kan när som helst avregistrera mig.</span></label>{error && <p className="pl-error" role="alert">{error}</p>}<button disabled={status === "sending"} className="pl-button pl-submit">{status === "sending" ? "Sparar din anmälan…" : "Meddela mig när ni öppnar"}<span>↗</span></button><p className="pl-form-footnote">Inget konto. Inga köpkrav. Bara ett första steg.</p></form></>}</div>;
}
