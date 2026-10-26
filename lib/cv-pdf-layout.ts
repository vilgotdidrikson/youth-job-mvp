export interface CvPdfSection { heading?: string; body: string }

const normalizedName = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase("sv-SE");
const isHeading = (line: string) => {
  const letters = line.replace(/[^A-Za-zÅÄÖåäö]/g, "");
  return letters.length > 2 && letters === letters.toUpperCase() && line.length < 80;
};

/** Presentation only: preserve all CV text, including headings in separate paragraphs. */
export function parseCvPdfText(cvText: string, fullName: string) {
  const name = fullName.trim() || "Mitt CV";
  const lines = cvText.replace(/\r\n?/g, "\n").trim().split("\n");
  if (fullName.trim() && normalizedName(lines[0] ?? "") === normalizedName(fullName)) lines.shift();
  const blocks = lines.join("\n").split(/\n\s*\n/).map(block => block.trim()).filter(Boolean);
  const sections: CvPdfSection[] = [];
  for (const block of blocks) {
    const [firstLine, ...rest] = block.split("\n");
    if (isHeading(firstLine.trim())) {
      sections.push({ heading: firstLine.trim(), body: rest.join("\n").trim() });
    } else if (sections.at(-1)?.heading && !sections.at(-1)?.body) {
      sections[sections.length - 1].body = block;
    } else sections.push({ body: block });
  }
  return { name, sections };
}
