/** Shared policy for optional presentation videos (web and future native app).
 * Metadata checks improve feedback; storage/API must enforce access, MIME and size
 * independently. A declared duration is not proof of the media's real duration.
 */
export const PROFILE_VIDEO_POLICY = {
  bucket: "youth-profile-videos",
  maxBytes: 30 * 1024 * 1024,
  maxDurationSeconds: 60,
  signedUrlSeconds: 5 * 60,
  formats: {
    "video/mp4": ["mp4"],
    "video/webm": ["webm"],
    "video/quicktime": ["mov"],
  },
} as const;

export type ProfileVideoMime = keyof typeof PROFILE_VIDEO_POLICY.formats;
export type ProfileVideoError = "empty" | "size" | "format" | "duration";
export type ProfileVideoValidation =
  | { ok: true; mimeType: ProfileVideoMime; extension: string }
  | { ok: false; code: ProfileVideoError; message: string };

export function validateProfileVideo(input: {
  name: string;
  type: string;
  size: number;
  durationSeconds: number;
}): ProfileVideoValidation {
  if (!Number.isFinite(input.size) || !Number.isInteger(input.size) || input.size <= 0) {
    return { ok: false, code: "empty", message: "Videofilen är tom eller kunde inte läsas." };
  }
  if (input.size > PROFILE_VIDEO_POLICY.maxBytes) {
    return { ok: false, code: "size", message: "Videon får vara högst 30 MB." };
  }
  const mimeType = input.type.toLowerCase();
  const extension = input.name.split(".").pop()?.toLowerCase() ?? "";
  if (!Object.hasOwn(PROFILE_VIDEO_POLICY.formats, mimeType) ||
    !(PROFILE_VIDEO_POLICY.formats[mimeType as ProfileVideoMime] as readonly string[]).includes(extension)) {
    return { ok: false, code: "format", message: "Välj en video i MP4-, WebM- eller MOV-format." };
  }
  if (!Number.isFinite(input.durationSeconds) || input.durationSeconds <= 0 ||
    input.durationSeconds > PROFILE_VIDEO_POLICY.maxDurationSeconds) {
    return { ok: false, code: "duration", message: "Videon får vara högst 60 sekunder och måste gå att spela upp." };
  }
  return { ok: true, mimeType: mimeType as ProfileVideoMime, extension };
}

/** Only accept our generated owner/UUID paths, never arbitrary URLs or traversal. */
export function isProfileVideoPath(path: unknown, ownerId: string): path is string {
  const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
  if (!new RegExp(`^${uuid}$`, "i").test(ownerId) || typeof path !== "string") return false;
  return new RegExp(`^${ownerId}/${uuid}\\.(mp4|webm|mov)$`, "i").test(path);
}
