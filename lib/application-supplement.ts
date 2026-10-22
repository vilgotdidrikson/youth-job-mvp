import type { ApplicationCompletion, ApplicationFollowup } from "./application-completions";

export interface SupplementQuestion {key:string; id:string; kind:"static"|"followup"; question:string; answer:string; status:"pending"|"answered"|"skipped"}
export function supplementQuestions(application: ApplicationCompletion, followups: ApplicationFollowup[]): SupplementQuestion[] {
  const initial: SupplementQuestion[] = application.status === "submitted" ? application.questions.map(question => ({
    key:`static:${question.id}`,id:question.id,kind:"static",question:question.question,answer:application.answers[question.id] ?? "",
    status:application.answers[question.id]?.trim() ? "answered" : application.omitted_question_ids?.includes(question.id) ? "skipped" : "pending",
  })) : [];
  return [...initial,...followups.map(question => ({...question,key:`followup:${question.id}`,kind:"followup" as const}))];
}
export function supplementPayload(items: SupplementQuestion[], drafts: Record<string,string>, skips: string[], editing: string[]) {
  const answers: Record<string,string> = {}, followupAnswers: Record<string,string> = {};
  const skipIds: string[] = [], followupSkipIds: string[] = [];
  for (const item of items) {
    if (item.status !== "pending" && !editing.includes(item.key)) continue;
    if (skips.includes(item.key)) (item.kind === "static" ? skipIds : followupSkipIds).push(item.id);
    else if (drafts[item.key]?.trim()) (item.kind === "static" ? answers : followupAnswers)[item.id] = drafts[item.key].trim();
  }
  return {answers,skipIds,followupAnswers,followupSkipIds};
}
