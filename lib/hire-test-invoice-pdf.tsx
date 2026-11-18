import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { HireTestInvoice } from "@/lib/hire-test-invoices";

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 12, color: "#202020" },
  heading: { fontSize: 24, fontWeight: "bold", marginBottom: 12 },
  note: { fontSize: 12, marginBottom: 24 },
  section: { marginBottom: 20, gap: 5 },
  bold: { fontWeight: "bold" },
});

export function HireTestInvoicePdf({ invoice, amount }: { invoice: HireTestInvoice; amount: string }) {
  return <Document title={`Testfaktura TEST-${invoice.id}`}>
    <Page size="A4" style={styles.page}>
      <Text style={styles.heading}>Testfaktura</Text>
      <Text style={styles.note}>Fiktivt underlag från MatchnWork. Betala inte.</Text>
      <View style={styles.section}>
        <Text>Nummer: TEST-{invoice.id}</Text>
        <Text>Fakturadatum: {invoice.issued_on}</Text>
        <Text>Förfallodatum i testet: {invoice.due_on}</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.bold}>Fakturamottagare</Text>
        <Text>{invoice.buyer_name}</Text>
        <Text>{invoice.address_line1}</Text>
        {invoice.address_line2 && <Text>{invoice.address_line2}</Text>}
        <Text>{invoice.postal_code} {invoice.city}</Text>
      </View>
      <View style={styles.section}>
        <Text>Avgift för bekräftad anställning, 1 st.</Text>
        <Text style={styles.bold}>Testbelopp: {amount}</Text>
      </View>
    </Page>
  </Document>;
}
