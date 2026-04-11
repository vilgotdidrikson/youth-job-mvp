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
