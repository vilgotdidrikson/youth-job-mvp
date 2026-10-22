/** Read-only refresh when a person returns to an open page; no background polling. */
export function subscribeVisibleRefresh(refresh: () => Promise<void>): () => void {
  let active = true;
  let busy = false;
  let lastStarted = 0;
  const run = () => {
    if (!active || busy || document.visibilityState !== "visible" || Date.now() - lastStarted < 1000) return;
    busy = true;
    lastStarted = Date.now();
    void Promise.resolve().then(() => { if (active) return refresh(); }).catch(() => {}).finally(() => { busy = false; });
  };
  window.addEventListener("focus", run);
  document.addEventListener("visibilitychange", run);
  return () => {
    active = false;
    window.removeEventListener("focus", run);
    document.removeEventListener("visibilitychange", run);
  };
}
