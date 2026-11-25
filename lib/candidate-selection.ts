import type { CandidateFeedItem } from "./types";

export function filterCandidates(candidates: CandidateFeedItem[], search: string): CandidateFeedItem[] {
  const query = search.trim().toLocaleLowerCase("sv-SE");
  return candidates.filter(candidate => [candidate.profile?.full_name, candidate.job.title].join(" ").toLocaleLowerCase("sv-SE").includes(query));
}

export function selectCandidate(candidates: CandidateFeedItem[], selectedId: string | null): CandidateFeedItem | null {
  return selectedId ? candidates.find(candidate => `${candidate.job.id}:${candidate.youthUserId}` === selectedId) ?? null : candidates[0] ?? null;
}
