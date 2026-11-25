import { jobPublicationReceipt } from "@/lib/job-publication";
import type { JobPost } from "@/lib/types";

export function JobPublicationNotice({ job }: { job: JobPost }) {
  return <section className="card job-publication-notice" role="status">
    <strong>{job.title}</strong><p>{jobPublicationReceipt(job)}</p>
  </section>;
}
