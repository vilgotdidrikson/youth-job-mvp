"use client";

import { getCurrentUser } from "@/lib/auth";
import { getSupabaseClient } from "@/lib/supabase";

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-");
}

export async function uploadJobImage(file: File): Promise<string> {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("You must be signed in to upload job images.");
  }

  const supabase = getSupabaseClient();
  const filePath = `${user.id}/${Date.now()}-${sanitizeFilename(file.name)}`;

  const { error: uploadError } = await supabase.storage.from("job-images").upload(filePath, file, {
    cacheControl: "3600",
    upsert: false,
  });

  if (uploadError) {
    console.error("Failed to upload job image.", uploadError);
    throw new Error(uploadError.message);
  }

  const { data } = supabase.storage.from("job-images").getPublicUrl(filePath);

  if (!data.publicUrl) {
    throw new Error("Unable to resolve a public URL for the uploaded job image.");
  }

  return data.publicUrl;
}

const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB (after compression)
const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024; // 5 MB
const SUPPORTED_DOCUMENT_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

async function compressImage(file: File): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const MAX_W = 1200;
      const ratio = Math.min(1, MAX_W / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * ratio);
      canvas.height = Math.round(img.height * ratio);
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(file); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
        },
        "image/jpeg",
        0.82,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file); };
    img.src = objectUrl;
  });
}

export async function uploadYouthDocument(file: File): Promise<string> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Du måste vara inloggad för att ladda upp filer.");

  let fileToUpload = file;

  if (file.type.startsWith("image/")) {
    fileToUpload = await compressImage(file);
    if (fileToUpload.size > MAX_IMAGE_BYTES) {
      throw new Error("Bilden är för stor (max 2 MB efter komprimering).");
    }
  } else if (SUPPORTED_DOCUMENT_TYPES.has(file.type)) {
    if (file.size > MAX_DOCUMENT_BYTES) {
      throw new Error("Dokumentet är för stort (max 5 MB).");
    }
  } else {
    throw new Error("Filtypen stöds inte. Välj ett PDF-, Word-, text-, JPG- eller PNG-dokument.");
  }

  const supabase = getSupabaseClient();
  const filePath = `${user.id}/${Date.now()}-${sanitizeFilename(fileToUpload.name)}`;

  const { error: uploadError } = await supabase.storage
    .from("youth-documents")
    .upload(filePath, fileToUpload, { cacheControl: "3600", upsert: false });

  if (uploadError) {
    console.error("Failed to upload youth document.", uploadError);
    throw new Error(uploadError.message);
  }

  const { data } = supabase.storage.from("youth-documents").getPublicUrl(filePath);
  if (!data.publicUrl) throw new Error("Kunde inte hämta URL för det uppladdade dokumentet.");

  return data.publicUrl;
}
