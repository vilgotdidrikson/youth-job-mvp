import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { HireBankInvoice, HireTestInvoice } from "@/lib/hire-test-invoices";

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 12, color: "#202020" },
  heading: { fontSize: 24, fontWeight: "bold", marginBottom: 12 },
  note: { fontSize: 12, marginBottom: 24 },
  section: { marginBottom: 20, gap: 5 },
  bold: { fontWeight: "bold" },
});

export function HireTestInvoicePdf({ invoice, amount }: { invoice: HireTestInvoice | HireBankInvoice; amount: string }) {
  const bank = "invoice_number" in invoice ? invoice : null;
  const title = bank ? "Faktura" : "Testfaktura";
  const number = bank?.invoice_number ?? `TEST-${invoice.id}`;
  return <Document title={`${title} ${number}`}>
    <Page size="A4" style={styles.page}>
      <Text style={styles.heading}>{title}</Text>
      {!bank && <Text style={styles.note}>Fiktivt underlag från MatchnWork. Betala inte.</Text>}
      <View style={styles.section}>
        <Text>Nummer: {number}</Text>
        <Text>Fakturadatum: {invoice.issued_on}</Text>
        <Text>{bank ? "Förfallodatum" : "Förfallodatum i testet"}: {invoice.due_on}</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.bold}>Fakturamottagare</Text>
        <Text>{invoice.buyer_name}</Text>
        {bank && <Text>Organisationsnummer: {bank.buyer_org}</Text>}
        <Text>{invoice.address_line1}</Text>
        {invoice.address_line2 && <Text>{invoice.address_line2}</Text>}
        <Text>{invoice.postal_code} {invoice.city}</Text>
      </View>
      <View style={styles.section}>
        <Text>Avgift för bekräftad anställning, 1 st.</Text>
        <Text style={styles.bold}>{bank ? "Att betala" : "Testbelopp"}: {amount}</Text>
      </View>
      {bank && <View style={styles.section}>
        <Text style={styles.bold}>{bank.seller.name}</Text>
        <Text>{bank.seller.address}</Text>
        <Text>Referens: {bank.seller.reference}</Text>
        <Text>Fakturafrågor: info@matchnwork.se</Text>
        <Text>Bankgiro: {bank.seller.bankgiro}</Text>
        <Text>Ange {number} som meddelande vid betalning.</Text>
      </View>}
    </Page>
  </Document>;
}
