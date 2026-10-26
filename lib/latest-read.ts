export type ReadState<T> = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; value: T };

/** Latest read wins, including transports that ignore AbortSignal. Never use for writes. */
export function createLatestRead<T, A = void>({ read, update, errorMessage, timeoutMs = 15_000 }: {
  read: (args: A, signal: AbortSignal) => PromiseLike<T>;
  update: (state: ReadState<T>) => void;
  errorMessage: string;
  timeoutMs?: number;
}) {
  let current: AbortController | null = null;
  let stopped = false;
  const load = async (args: A) => {
    if (stopped) return;
    current?.abort();
    const controller = new AbortController();
    current = controller;
    update({ status: "loading" });
    let onAbort: () => void = () => {};
    const cancelled = new Promise<never>((_, reject) => {
      onAbort = () => reject(new Error(errorMessage));
      controller.signal.addEventListener("abort", onAbort, { once: true });
    });
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const value = await Promise.race([cancelled, read(args, controller.signal)]);
      if (!stopped && current === controller) update({ status: "ready", value });
    } catch {
      if (!stopped && current === controller) update({ status: "error", message: errorMessage });
    } finally {
      clearTimeout(timer);
      controller.signal.removeEventListener("abort", onAbort);
      if (current === controller) current = null;
    }
  };
  return {
    load,
    stop() { stopped = true; current?.abort(); current = null; },
  };
}
