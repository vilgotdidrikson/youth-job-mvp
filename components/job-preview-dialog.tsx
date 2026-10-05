"use client";

import { useState } from "react";
import { ModalDialog } from "./modal-dialog";
import { UiIcon } from "./ui-icon";

interface PreviewForm {
  title: string; description: string; employmentType: string; minAge: string; maxAge: string;
  requirements: string; benefits: string; address: string; postalCode: string; city: string;
}
const list = (value: string) => value.split(/[,\n]+/).map((item) => item.trim()).filter(Boolean);

export function JobPreviewDialog({ form, image, companyName, salary, onClose }: { form: PreviewForm; image?: string; companyName: string; salary: string; onClose: () => void }) {
  const [device, setDevice] = useState<"mobile" | "desktop">("mobile");
  return <ModalDialog labelledBy="job-preview-heading" onClose={onClose} className="mnw-job-preview-modal">
    <header className="job-preview-toolbar"><div><p>Innan du publicerar</p><h2 id="job-preview-heading">Förhandsvisa annonsen</h2></div><button type="button" className="job-builder-preview-close" onClick={onClose} aria-label="Stäng förhandsvisning"><UiIcon name="close" width="20" /></button></header>
    <div className="job-preview-switch" aria-label="Välj förhandsvisning"><button type="button" aria-pressed={device === "mobile"} onClick={() => setDevice("mobile")}>Mobil</button><button type="button" aria-pressed={device === "desktop"} onClick={() => setDevice("desktop")}>Dator</button></div>
    <div className="job-preview-stage"><article className={`job-preview-detail is-${device}`}>
      <div className="job-preview-image">{image ? <img src={image} alt="Annonsens omslagsbild" draggable={false} /> : <UiIcon name="briefcase" width="46" height="46" />}</div>
      <div className="job-preview-detail-layout"><div><p className="job-preview-company">{companyName || "Ditt företag"}</p><h2>{form.title || "Din jobbtitel"}</h2><p className="job-preview-location"><UiIcon name="map" width="16" />{[form.city, form.employmentType].filter(Boolean).join(" · ") || "Ort och anställningsform"}</p><section><h3>Om jobbet</h3><p>{form.description || "Här visas arbetsbeskrivningen när du börjar skriva."}</p></section><section><h3>Anställningsform</h3><p>{form.employmentType || "Anställningsform är inte angiven"}</p></section></div>
      <aside className="job-preview-facts" aria-label="Annonsens villkor"><section><h3>Krav</h3><p>{[form.minAge || form.maxAge ? `${form.minAge || "?"}–${form.maxAge || "?"} år` : "", ...list(form.requirements)].filter(Boolean).join(" · ") || "Inga särskilda krav"}</p></section><section><h3>Förmåner</h3><p>{list(form.benefits).join(" · ") || "Inga förmåner angivna"}</p></section><section><h3>Lön</h3><p>{salary}</p></section><section><h3>Plats</h3><p>{[form.address, form.postalCode, form.city].filter(Boolean).join(", ") || "Plats är inte angiven"}</p></section></aside></div>
    </article></div><p className="job-preview-footer-note">Förhandsvisningen visar ditt utkast. Annonsen publiceras först när du väljer Publicera annons.</p>
  </ModalDialog>;
}
