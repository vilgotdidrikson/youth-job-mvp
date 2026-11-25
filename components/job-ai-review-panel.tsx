"use client";
import type { AiChange, AiJobReview } from "@/lib/job-ai-review";

const changes = (items: AiChange[]) => <dl>{items.map(item => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>;

/** What the AI suggestion changed, split into the public listing and internal matching (F11). */
export function JobAiReviewPanel({ review, onAddRequirement, onClose }: { review: AiJobReview; onAddRequirement: (item: string) => void; onClose: () => void }) {
  return <section className="job-ai-review" aria-labelledby="job-ai-review-title">
    <div className="job-ai-review-head"><h3 id="job-ai-review-title">Granska AI-förslaget före publicering</h3><button type="button" onClick={onClose}>Dölj</button></div>
    {review.listing.length > 0 && <><h4>I annonsen – syns för sökande</h4>{changes(review.listing)}</>}
    {review.transferred.length > 0 && <><h4>Överfört till fälten från er egen text</h4><ul>{review.transferred.map(item => <li key={item}>{item}</li>)}</ul></>}
    {review.matching.length > 0 && <><h4>I matchningen – internt, syns inte i annonsen</h4>{changes(review.matching)}</>}
    {review.suggestedMustHaves.length > 0 && <><h4>Föreslagna krav som inte är tillagda</h4><p>AI tolkade detta som krav, men det står inte bland era krav. Lägg bara till det som verkligen är ett absolut krav. Det läggs då till både i annonsen och i matchningen.</p><ul className="job-ai-review-suggestions">{review.suggestedMustHaves.map(item => <li key={item}><span>{item}</span><button type="button" className="secondary-btn" onClick={() => onAddRequirement(item)}>Lägg till som krav</button></li>)}</ul></>}
    {review.review.length > 0 && <><h4>Behöver granskas</h4><ul className="job-ai-review-warnings">{review.review.map(item => <li key={item}>{item}</li>)}</ul></>}
    {!review.listing.length && !review.matching.length && !review.transferred.length && !review.suggestedMustHaves.length && !review.review.length && <p>AI-förslaget ändrade inga fält.</p>}
  </section>;
}
