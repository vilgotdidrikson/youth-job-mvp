export interface PublicJobInformationData {
  title: string;
  description: string;
  requirements: string;
}

/** Only public listing fields are rendered, including during a rolling deploy. */
export function PublicJobInformation({ job }: { job: PublicJobInformationData }) {
  return <>
    <h3>{job.title}</h3>
    {job.description && <p style={{ whiteSpace: "pre-wrap" }}>{job.description}</p>}
    {job.requirements && <><h4>Krav i annonsen</h4><p style={{ whiteSpace: "pre-wrap" }}>{job.requirements}</p></>}
    <p>Här visas informationen i den publicerade annonsen. Eventuella kompletteringar är frivilliga. Beskriv dina egna erfarenheter och rätta uppgifter som inte stämmer.</p>
  </>;
}
