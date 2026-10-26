/** Opens only the explicitly resolved document; timeout/abort never opens a late result. */
export async function openCvDocument({ resolveUrl, openWindow, signal, timeoutMs = 15_000 }: {
  resolveUrl: (signal: AbortSignal) => Promise<string>;
  openWindow: () => Pick<Window, "opener" | "location" | "close" | "closed"> | null;
  signal: AbortSignal;
  timeoutMs?: number;
}) {
  const win = openWindow();
  if (!win) throw new Error("Tillåt ett nytt fönster och försök igen för att öppna CV:t.");
  win.opener = null;
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) controller.abort();
  const timer = setTimeout(abort, timeoutMs);
  let onAbort: () => void = () => {};
  try {
    const cancelled = new Promise<never>((_, reject) => {
      onAbort = () => reject(new Error("CV-hämtningen avbröts eller tog för lång tid. Försök igen."));
      controller.signal.addEventListener("abort", onAbort, { once: true });
      if (controller.signal.aborted) onAbort();
    });
    const url = await Promise.race([cancelled, resolveUrl(controller.signal)]);
    if (controller.signal.aborted) throw new Error("CV-hämtningen avbröts. Försök igen.");
    if (!url) throw new Error("CV-filen kunde inte öppnas.");
    if (win.closed) throw new Error("CV-fönstret stängdes. Försök igen för att öppna det.");
    win.location.href = url;
  } catch (reason) {
    win.close();
    throw reason;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", abort);
    controller.signal.removeEventListener("abort", onAbort);
  }
}
