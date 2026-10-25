/** Shared withdrawal copy/rules; no web or Supabase dependencies. */
export interface WithdrawalResult {
  status: "withdrawn";
  was_submitted: boolean;
  withdrawn_at: string;
  match_id: string | null;
}

export function withdrawalCopy(submitted: boolean) {
  return submitted ? {
    action: "Återkalla ansökan",
    title: "Återkalla din ansökan?",
    body: "Du lämnar rekryteringen och företaget får veta att ansökan är återkallad. En eventuell match avslutas. Chatthistoriken finns kvar att läsa, men ni kan inte skicka fler meddelanden. Underlag som företaget redan har läst eller hämtat tas inte tillbaka.",
    confirmation: "Ansökan är återkallad.",
  } : {
    action: "Ta bort sparat intresse",
    title: "Ta bort ditt sparade intresse?",
    body: "Intresset skickas inte till företaget när du gör klart ditt CV. Jobbet finns kvar i din ansökningshistorik som återkallat. Ditt CV och din profil påverkas inte.",
    confirmation: "Det sparade intresset är borttaget och kommer inte att skickas.",
  };
}

export function chatIsReadOnly(status: string): boolean {
  return status === "cancelled" || status === "rejected";
}

export function canWithdrawApplication(status: string, matchStatus?: string): boolean {
  return status !== "withdrawn" && matchStatus !== "hired";
}
