"use client";
import { useEffect, useRef, type ReactNode } from "react";

/** Native modality keeps keyboard focus inside the dialog and restores it on close. */
export function ModalDialog({ children, label, labelledBy, onClose, busy = false, className = "" }: { children: ReactNode; label?: string; labelledBy?: string; onClose: () => void; busy?: boolean; className?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
    return () => { if (element?.open) element.close(); };
  }, []);
  return <dialog ref={dialog} className={`mnw-modal-dialog ${className}`} aria-label={label} aria-labelledby={labelledBy} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }} onClick={(event) => {
    if (busy || event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
  }}>{children}</dialog>;
}
