"use client";

import { ModalDialog } from "./modal-dialog";
import { useEffect, useMemo, useState } from "react";

interface ImageCropDialogProps {
  file: File;
  onCancel: () => void;
  onConfirm: (file: File) => void;
}

const OUTPUT_WIDTH = 1200;
const OUTPUT_HEIGHT = 900;

async function cropImage(file: File, zoom: number, offsetX: number, offsetY: number): Promise<File> {
  const source = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Bilden kunde inte läsas."));
      element.src = source;
    });
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_WIDTH;
    canvas.height = OUTPUT_HEIGHT;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Bilden kunde inte beskäras i den här webbläsaren.");

    const coverScale = Math.max(OUTPUT_WIDTH / image.naturalWidth, OUTPUT_HEIGHT / image.naturalHeight);
    const scale = coverScale * zoom;
    const visibleWidth = OUTPUT_WIDTH / scale;
    const visibleHeight = OUTPUT_HEIGHT / scale;
    const maxSourceX = Math.max(0, image.naturalWidth - visibleWidth);
    const maxSourceY = Math.max(0, image.naturalHeight - visibleHeight);
    const sourceX = maxSourceX * (1 - offsetX) / 2;
    const sourceY = maxSourceY * (1 - offsetY) / 2;
    context.drawImage(image, sourceX, sourceY, visibleWidth, visibleHeight, 0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);

    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
      (result) => result ? resolve(result) : reject(new Error("Bilden kunde inte sparas.")),
      "image/jpeg",
      0.88,
    ));
    const baseName = file.name.replace(/\.[^.]+$/, "") || "annonsbild";
    return new File([blob], `${baseName}-beskuren.jpg`, { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(source);
  }
}

export function ImageCropDialog({ file, onCancel, onConfirm }: ImageCropDialogProps) {
  const previewUrl = useMemo(() => URL.createObjectURL(file), [file]);
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => () => URL.revokeObjectURL(previewUrl), [previewUrl]);

  const confirm = async () => {
    setSaving(true);
    setError("");
    try {
      onConfirm(await cropImage(file, zoom, offsetX, offsetY));
    } catch (cropError) {
      setError(cropError instanceof Error ? cropError.message : "Bilden kunde inte beskäras.");
      setSaving(false);
    }
  };

  return (
    <ModalDialog labelledBy="image-crop-title" onClose={onCancel} busy={saving}>
      <section className="image-crop-dialog">
        <div className="image-crop-heading"><div><p>Annonsbild</p><h2 id="image-crop-title">Beskär omslagsbilden</h2></div><button type="button" onClick={onCancel} disabled={saving} aria-label="Stäng">×</button></div>
        <div className="image-crop-viewport">
          {/* Blob URLs are local previews and cannot use the Next image optimizer. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img draggable={false} src={previewUrl} alt="Förhandsgranskning av beskärning" style={{ objectPosition: `${50 - offsetX * 50}% ${50 - offsetY * 50}%`, transform: `scale(${zoom})`, transformOrigin: `${50 - offsetX * 50}% ${50 - offsetY * 50}%` }} />
          <span aria-hidden="true" />
        </div>
        <p className="image-crop-help">Behåll det viktigaste i mitten. Bilden beskärs i formatet 4:3 och används som annonsens omslag.</p>
        <div className="image-crop-controls">
          <label>Zoom<input type="range" min="1" max="3" step="0.01" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /></label>
          <label>Flytta vågrätt<input type="range" min="-1" max="1" step="0.01" value={offsetX} onChange={(event) => setOffsetX(Number(event.target.value))} /></label>
          <label>Flytta lodrätt<input type="range" min="-1" max="1" step="0.01" value={offsetY} onChange={(event) => setOffsetY(Number(event.target.value))} /></label>
        </div>
        {error && <p className="auth-message auth-error" role="alert">{error}</p>}
        <footer><button type="button" className="secondary-btn" onClick={onCancel} disabled={saving}>Avbryt</button><button type="button" className="cta-btn" onClick={() => void confirm()} disabled={saving}>{saving ? "Beskär..." : "Beskär och använd"}</button></footer>
      </section>
    </ModalDialog>
  );
}
