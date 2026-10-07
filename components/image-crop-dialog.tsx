"use client";

import { ModalDialog } from "./modal-dialog";
import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { cropSourceRect, panCrop, zoomCrop, type CropPosition, type CropSize } from "../lib/image-crop-geometry";

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

    const rect = cropSourceRect({ width: image.naturalWidth, height: image.naturalHeight }, { zoom, offsetX, offsetY });
    context.drawImage(image, rect.x, rect.y, rect.width, rect.height, 0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);

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
  const [position, setPosition] = useState<CropPosition>({ zoom: 1, offsetX: 0, offsetY: 0 });
  const { zoom, offsetX, offsetY } = position;
  const positionRef = useRef(position);
  const viewportRef = useRef<HTMLDivElement>(null);
  const imageSize = useRef<CropSize | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => () => URL.revokeObjectURL(previewUrl), [previewUrl]);

  const updatePosition = (next: CropPosition) => { positionRef.current = next; setPosition(next); };

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const wheel = (event: WheelEvent) => {
      if (saving || !imageSize.current) return;
      event.preventDefault();
      const rect = viewport.getBoundingClientRect();
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1);
      const next = zoomCrop(positionRef.current, imageSize.current, rect,
        positionRef.current.zoom * Math.exp(-delta * 0.002), event.clientX - rect.left, event.clientY - rect.top);
      positionRef.current = next;
      setPosition(next);
    };
    viewport.addEventListener("wheel", wheel, { passive: false });
    return () => viewport.removeEventListener("wheel", wheel);
  }, [saving]);

  const movePointer = (event: PointerEvent<HTMLDivElement>) => {
    if (saving || !pointers.current.has(event.pointerId) || !imageSize.current) return;
    const previous = [...pointers.current.values()];
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const current = [...pointers.current.values()];
    const rect = event.currentTarget.getBoundingClientRect();
    let next = positionRef.current;
    if (current.length === 1) {
      next = panCrop(next, imageSize.current, rect, current[0].x - previous[0].x, current[0].y - previous[0].y);
    } else if (current.length === 2) {
      const distance = (points: typeof current) => Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
      const oldX = (previous[0].x + previous[1].x) / 2;
      const oldY = (previous[0].y + previous[1].y) / 2;
      if (distance(previous) > 0) next = zoomCrop(next, imageSize.current, rect,
        next.zoom * distance(current) / distance(previous), oldX - rect.left, oldY - rect.top);
      next = panCrop(next, imageSize.current, rect, (current[0].x + current[1].x) / 2 - oldX, (current[0].y + current[1].y) / 2 - oldY);
    }
    updatePosition(next);
  };

  const releasePointer = (event: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    setDragging(pointers.current.size > 0);
  };

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
        <div ref={viewportRef} className={`image-crop-viewport${dragging ? " is-dragging" : ""}`}
          onPointerDown={(event) => {
            if (saving || !imageSize.current || event.button !== 0 || pointers.current.size >= 2) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
            setDragging(true);
          }} onPointerMove={movePointer} onPointerUp={releasePointer} onPointerCancel={releasePointer} onLostPointerCapture={releasePointer}>
          {/* Blob URLs are local previews and cannot use the Next image optimizer. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img draggable={false} src={previewUrl} onLoad={(event) => { imageSize.current = { width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight }; }} alt="Förhandsgranskning av beskärning" style={{ objectPosition: `${50 - offsetX * 50}% ${50 - offsetY * 50}%`, transform: `scale(${zoom})`, transformOrigin: `${50 - offsetX * 50}% ${50 - offsetY * 50}%` }} />
          <span aria-hidden="true" />
        </div>
        <p className="image-crop-help">Dra bilden med musen eller fingret. Zooma med scrollhjulet, nyp med två fingrar eller använd reglagen. Bilden beskärs i formatet 4:3.</p>
        <div className="image-crop-controls">
          <label>Zoom<input disabled={saving} type="range" min="1" max="3" step="0.01" value={zoom} onChange={(event) => updatePosition({ ...positionRef.current, zoom: Number(event.target.value) })} /></label>
          <label>Flytta vågrätt<input disabled={saving} type="range" min="-1" max="1" step="0.01" value={offsetX} onChange={(event) => updatePosition({ ...positionRef.current, offsetX: Number(event.target.value) })} /></label>
          <label>Flytta lodrätt<input disabled={saving} type="range" min="-1" max="1" step="0.01" value={offsetY} onChange={(event) => updatePosition({ ...positionRef.current, offsetY: Number(event.target.value) })} /></label>
        </div>
        {error && <p className="auth-message auth-error" role="alert">{error}</p>}
        <footer><button type="button" className="secondary-btn" onClick={onCancel} disabled={saving}>Avbryt</button><button type="button" className="cta-btn" onClick={() => void confirm()} disabled={saving}>{saving ? "Beskär..." : "Beskär och använd"}</button></footer>
      </section>
    </ModalDialog>
  );
}
