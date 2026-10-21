/**
 * What the youth's application overview shows and counts (F13). Framework-free
 * so web and a future mobile app agree on what "sent" means.
 */
import type { YouthActivity } from "./youth-activity";

interface ApplicationLike { job_id: string; status: string }

/** Activity without an application row: saved interest or a stage reached another way. */
export function activityWithoutApplication<T extends ApplicationLike>(activity: YouthActivity[], items: T[]): YouthActivity[] {
  return activity.filter(stage => !items.some(item => item.job_id === stage.jobId));
}

export function isUnsent(entry: ApplicationLike | YouthActivity): boolean {
  return "jobId" in entry ? entry.status === "draft" : entry.status === "needs_completion";
}

/** Every card shown under Alla is counted, so the counter never contradicts the list. */
export function applicationCounts<T extends ApplicationLike>(items: T[], activity: YouthActivity[], needsAnswers: (item: T) => boolean) {
  const extra = activityWithoutApplication(activity, items);
  return {
    all: items.length + extra.length,
    unsent: items.filter(isUnsent).length + extra.filter(isUnsent).length,
    questions: items.filter(needsAnswers).length,
  };
}

export type PendingInterestAction = "complete_cv" | "send" | "none" | "checking";

export interface PendingInterestView { label: string; body: string; action: PendingInterestAction; showJobLink: boolean }

/**
 * Saved interest is never sent to the company. It is sent automatically when the
 * CV is saved, provided the listing is still open; this states that plainly.
 */
export function pendingInterestView(stage: Pick<YouthActivity, "available">, cvCompleted: boolean | null): PendingInterestView {
  if (stage.available === false) return {
    label: "Tar inte emot ansökningar", action: "none", showJobLink: false,
    body: "Annonsen är pausad, stängd eller borttagen. Ditt sparade intresse skickas inte till företaget.",
  };
  if (cvCompleted === null) return { label: "Inte skickad ännu", action: "checking", showJobLink: true, body: "Ditt intresse är sparat men inte skickat till företaget." };
  if (cvCompleted) return {
    label: "Inte skickad ännu", action: "send", showJobLink: true,
    body: "Ditt CV är klart, men ansökan har inte skickats. Skicka den nu så får företaget den direkt.",
  };
  return {
    label: "Inte skickad ännu", action: "complete_cv", showJobLink: true,
    body: "Ditt intresse är sparat men inte skickat till företaget. Ansökan skickas automatiskt när ditt CV är sparat, så länge annonsen är öppen.",
  };
}

/** Job page action while a saved interest exists and nothing has been sent. */
export function savedInterestAction(cvCompleted: boolean): { label: string; note: string; kind: "complete_cv" | "send" } {
  return cvCompleted
    ? { kind: "send", label: "Skicka ansökan", note: "Ditt intresse är sparat men inte skickat. Ditt CV är klart, så du kan skicka ansökan nu." }
    : { kind: "complete_cv", label: "Gör klart CV:t", note: "Ditt intresse är sparat men inte skickat. Ansökan skickas automatiskt när ditt CV är sparat." };
}

/** Discreet CV reminder in the notice list (F14): how many saved interests wait for the CV. */
export function pendingInterestReminder(count: number): string {
  if (count <= 0) return "Du kan upptäcka och spara jobb nu. Ett CV behövs innan ansökningarna skickas till företagen.";
  return count === 1
    ? "Du har 1 sparat intresse som inte är skickat till företaget ännu. Det skickas automatiskt när ditt CV är sparat, så länge annonsen är öppen."
    : `Du har ${count} sparade intressen som inte är skickade till företagen ännu. De skickas automatiskt när ditt CV är sparat, så länge annonserna är öppna.`;
}
