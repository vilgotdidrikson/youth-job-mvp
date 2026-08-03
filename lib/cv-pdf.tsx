"use client";

import { Document, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { paddingTop: 48, paddingRight: 46, paddingBottom: 50, paddingLeft: 46, fontFamily: "Helvetica", color: "#39242d" },
  header: { marginBottom: 24, paddingBottom: 14, borderBottomWidth: 2, borderBottomColor: "#dc6f8d" },
  name: { fontSize: 25, fontFamily: "Helvetica-Bold", letterSpacing: -0.4 },
  brand: { marginTop: 5, color: "#a85d74", fontSize: 9, letterSpacing: 1.2, textTransform: "uppercase" },
  section: { marginBottom: 16 },
  heading: { marginBottom: 5, color: "#c65d7c", fontSize: 10, fontFamily: "Helvetica-Bold", letterSpacing: 1, textTransform: "uppercase" },
  body: { color: "#503842", fontSize: 10.5, lineHeight: 1.55 },
  footer: { position: "absolute", bottom: 26, left: 46, right: 46, color: "#a57b88", fontSize: 8, textAlign: "center" },
});

interface CvSection {
  heading?: string;
  body: string;
}

function isHeading(line: string): boolean {
  const letters = line.replace(/[^A-Za-zÅÄÖåäö]/g, "");
  return letters.length > 2 && letters === letters.toUpperCase() && line.length < 58;
}

function parseCv(cvText: string): { name: string; sections: CvSection[] } {
  const blocks = cvText.trim().split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);
  const firstBlockLines = blocks.shift()?.split("\n") ?? [];
  const name = firstBlockLines.shift()?.trim() || "Mitt CV";
  const sections: CvSection[] = [];

  if (firstBlockLines.join(" ").trim()) sections.push({ body: firstBlockLines.join("\n").trim() });

  for (const block of blocks) {
    const [firstLine, ...rest] = block.split("\n");
    sections.push(
      isHeading(firstLine.trim())
        ? { heading: firstLine.trim(), body: rest.join("\n").trim() }
        : { body: block },
    );
  }

  return { name, sections: sections.filter((section) => section.body) };
}

function CvPdfDocument({ cvText }: { cvText: string }) {
  const { name, sections } = parseCv(cvText);

  return (
    <Document title={`${name} - CV`} author="Employo">
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.brand}>CV skapad med Employo</Text>
        </View>
        {sections.map((section, index) => (
          <View key={`${section.heading ?? "text"}-${index}`} style={styles.section}>
            {section.heading && <Text style={styles.heading}>{section.heading}</Text>}
            <Text style={styles.body}>{section.body}</Text>
          </View>
        ))}
        <Text style={styles.footer} fixed>Employo - ditt CV, din start</Text>
      </Page>
    </Document>
  );
}

function safeFilename(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9ÅÄÖåäö_-]+/g, "-").replace(/^-+|-+$/g, "") || "mitt-cv";
}

export async function createCvPdfFile(cvText: string, fullName: string): Promise<File> {
  const blob = await pdf(<CvPdfDocument cvText={cvText} />).toBlob();
  return new File([blob], `${safeFilename(fullName || "mitt-cv")}-employo-cv.pdf`, { type: "application/pdf" });
}

export function downloadPdfFile(file: File): void {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
