import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { parseCvPdfText } from "./cv-pdf-layout";

// Called only inside the serialized export operation. Fontkit's loaded glyph state
// must not be reused across documents (it can corrupt copied/extracted characters).
export async function registerCvPdfFonts() {
  const others = Object.values(Font.getRegisteredFonts()).filter(family => family.family !== "MatchnWorkPdf")
    .map(family => ({ family: family.family, fonts: family.sources.map(source => ({
      src: source.src, fontStyle: source.fontStyle, fontWeight: source.fontWeight, ...source.options,
    })) }));
  const hyphenation = Font.getHyphenationCallback();
  const emoji = Font.getEmojiSource();
  Font.clear();
  others.forEach(definition => Font.register(definition));
  if (hyphenation) Font.registerHyphenationCallback(hyphenation);
  if (emoji) Font.registerEmojiSource(emoji);
  Font.register({ family: "MatchnWorkPdf", fonts: [
    { src: "/fonts/cv-inter-regular.ttf", fontWeight: 400 },
    { src: "/fonts/cv-inter-semibold.ttf", fontWeight: 600 },
  ] });
  await Promise.all([400, 700].map(fontWeight => Font.load({ fontFamily: "Helvetica", fontWeight })));
}

// Matches theme.css. The PDF renderer cannot resolve browser CSS variables.
const styles = StyleSheet.create({
  page: { paddingTop: 48, paddingRight: 46, paddingBottom: 56, paddingLeft: 46, fontFamily: "MatchnWorkPdf", color: "#4c303b" },
  header: { marginBottom: 22, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: "#b84164" },
  name: { fontSize: 25, fontWeight: 600, lineHeight: 1.2 },
  brand: { marginTop: 6, color: "#7f616d", fontSize: 9 },
  section: { marginBottom: 14 },
  heading: { marginBottom: 5, color: "#b84164", fontSize: 10, fontWeight: 600 },
  body: { fontSize: 11, lineHeight: 1.45 },
  continuation: { position: "absolute", top: 23, left: 46, right: 46, fontSize: 9, color: "#7f616d" },
  footer: { position: "absolute", bottom: 25, left: 46, right: 46, color: "#7f616d", fontSize: 9, textAlign: "center" },
});

/** Pure template shared by browser export and PDF layout verification. */
export function CvPdfDocument({ cvText, fullName }: { cvText: string; fullName: string }) {
  const { name, sections } = parseCvPdfText(cvText, fullName);
  return <Document title={`${name} - CV`} author="MatchnWork" language="sv-SE">
    <Page size="A4" style={styles.page}>
      <Text style={styles.continuation} fixed render={({ pageNumber }) => pageNumber > 1 ? `${name} - CV` : ""} />
      <View style={styles.header} wrap={false}>
        <Text style={styles.name} hyphenationCallback={word => [word]}>{name}</Text>
        <Text style={styles.brand}>CV skapat med MatchnWork</Text>
      </View>
      {sections.map((section, index) => <View key={index} style={styles.section}>
        {section.body ? <Text style={styles.body} orphans={section.heading ? 3 : 2} widows={2}>
          {section.heading && <Text style={styles.heading}>{section.heading}{"\n"}</Text>}
          {section.body}
        </Text> : <Text style={styles.heading}>{section.heading}</Text>}
      </View>)}
      <Text style={styles.footer} fixed render={({ pageNumber, totalPages }) => `MatchnWork - ${pageNumber} / ${totalPages}`} />
    </Page>
  </Document>;
}
