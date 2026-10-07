/** Temporary interview data belongs to one account, including on shared devices. */
export function voiceCvStorageKey(base: string, userId: string | undefined): string {
  return `${base}:${userId ?? "signed-out"}`;
}
