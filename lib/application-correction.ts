import type { ApplicationDisclosure, DisclosurePreview } from "./application-disclosure";

/** Pure request/receipt contracts, shared by web and future mobile clients. */
export function applicationDisclosureSaveRequest(jobId: string, preview: DisclosurePreview, sent: boolean, youthId: string) {
  const args = { p_job_id: jobId, p_selection: preview.selected_keys, p_source_token: preview.source_token };
  if (!sent) return { name: "save_my_application_disclosure", args };
  if (!Number.isSafeInteger(preview.base_revision) || preview.base_revision! < 1) {
    throw new Error("Läs aktuellt underlag innan du delar rättelsen.");
  }
  return { name: "correct_my_application_disclosure", args: { ...args, p_expected_revision: preview.base_revision, p_expected_youth_id: youthId } };
}

export function verifyApplicationCorrectionReceipt(value: unknown, jobId: string, youthId: string, baseRevision: number) {
  const packet = value as Partial<ApplicationDisclosure> | null;
  if (!packet || packet.job_id !== jobId || packet.youth_user_id !== youthId || !Number.isSafeInteger(packet.revision) || packet.revision! < baseRevision) {
    throw new Error("Rättelsen kunde inte bekräftas. Läs aktuellt underlag innan du försöker igen.");
  }
}
