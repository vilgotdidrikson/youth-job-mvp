import type { CandidateAssessment } from "./candidate-assessment";

export type AssessmentState = {
  status: string;
  assessment?: CandidateAssessment | null;
  updated_at?: string | null;
  retrying?: boolean;
};

/** One bounded, read-only observer. Manual recovery uses the existing authorized API. */
export function observeAssessment(options: {
  read: (signal: AbortSignal) => Promise<AssessmentState>;
  enqueue: (signal: AbortSignal) => Promise<void>;
  update: (state: AssessmentState) => void;
  fail: (message: string) => void;
  visible: () => boolean;
  pollMs?: number;
  waitMs?: number;
  requestMs?: number;
}) {
  let stopped = false;
  let reading = false;
  let enqueued = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const controller = new AbortController();
  let deadline: ReturnType<typeof setTimeout> | undefined;
  const armDeadline = () => {
    if (deadline) return;
    deadline = setTimeout(() => {
      if (stopped) return;
      stop();
      options.fail("Bedömningen tar längre tid än väntat. Försök igen för att uppdatera den direkt.");
    }, options.waitMs ?? 60_000);
  };
  armDeadline();
  function stop() {
    stopped = true;
    controller.abort();
    clearTimeout(timer);
    clearTimeout(deadline);
  }
  async function refresh() {
    if (stopped || reading || !options.visible()) return;
    reading = true;
    try {
      const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(options.requestMs ?? 12_000)]);
      let state = await assessmentDeadline(options.read(signal), signal);
      if (stopped) return;
      options.update(state);
      if (state.status === "unrequested" && !enqueued) {
        enqueued = true;
        await assessmentDeadline(options.enqueue(signal), signal);
        if (stopped) return;
        state = { status: "pending" };
        options.update(state);
      }
      if (["pending", "processing"].includes(state.status) || (state.status === "failed" && state.retrying)) {
        armDeadline();
        clearTimeout(timer);
        timer = setTimeout(() => void refresh(), options.pollMs ?? 10_000);
      } else {
        clearTimeout(timer);
        clearTimeout(deadline); deadline = undefined;
        if (state.status === "failed" || state.status === "cancelled" || !state.assessment) {
          options.fail("Den automatiska bedömningen kunde inte slutföras. Försök igen för att uppdatera den direkt.");
        }
      }
    } catch {
      if (!stopped) {
        stop();
        options.fail("Kunde inte hämta bedömningen. Kontrollera anslutningen och försök igen.");
      }
    } finally { reading = false; }
  }
  void refresh();
  return { refresh, stop };
}

/** Also bounds authentication and transports that do not observe abort themselves. */
export function assessmentDeadline<T>(promise: PromiseLike<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(new Error("Bedömningen tog för lång tid. Försök igen."));
    if (signal.aborted) { abort(); return; }
    signal.addEventListener("abort", abort, { once: true });
    Promise.resolve(promise).then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}
