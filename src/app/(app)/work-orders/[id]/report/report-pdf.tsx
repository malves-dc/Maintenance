/* eslint-disable jsx-a11y/alt-text -- react-pdf <Image> is not an HTML img and has no alt prop */
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { PdfFooter, PdfHeader } from "@/components/pdf/letterhead";
import type { Letterhead } from "@/lib/letterhead";

// Client-facing service report. Internal costs are deliberately left out.

export type ReportData = {
  labels: Record<string, string>;
  lh: Letterhead;
  number: number;
  title: string;
  generatedAt: string;
  info: [string, string][];
  description: string | null;
  /** The technician's report: what was done. */
  workReport: string | null;
  checklist: { label: string; heading: boolean; answer: string; note: string | null; image: Buffer | null }[];
  time: { who: string; when: string; duration: string; note: string | null }[];
  totalTime: string;
  parts: { name: string; sku: string | null; qty: string; serials: string[] }[];
  photos: Buffer[];
  signature: { image: Buffer; name: string; at: string } | null;
  /** No signature because the client wasn't there. */
  clientAbsent: boolean;
};

const s = StyleSheet.create({
  page: { padding: 36, paddingBottom: 54, fontSize: 9.5, fontFamily: "Helvetica", color: "#16181d" },
  muted: { color: "#6b7280" },
  h2: { fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 16, marginBottom: 6 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: "50%", paddingVertical: 3, paddingRight: 8, flexDirection: "row" },
  key: { width: 90, color: "#6b7280" },
  row: { flexDirection: "row", borderBottom: "0.5pt solid #e5e7eb", paddingVertical: 4 },
  heading: { fontFamily: "Helvetica-Bold", backgroundColor: "#f3f4f6", paddingVertical: 4, paddingHorizontal: 4, marginTop: 4 },
  photos: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  photo: { width: 170, height: 128, objectFit: "cover", borderRadius: 3 },
});

export function ServiceReport({ d }: { d: ReportData }) {
  const L = d.labels;
  return (
    <Document title={`${L.reportTitle} #${d.number}`} author={d.lh.name}>
      <Page size="A4" style={s.page}>
        <PdfHeader lh={d.lh} title={L.reportTitle} reference={`#${d.number}`} date={d.generatedAt} />

        <Text style={{ fontSize: 12, fontFamily: "Helvetica-Bold", marginBottom: 8 }}>{d.title}</Text>
        <View style={s.grid}>
          {d.info.map(([k, v]) => (
            <View key={k} style={s.cell}>
              <Text style={s.key}>{k}</Text>
              <Text style={{ flex: 1 }}>{v}</Text>
            </View>
          ))}
        </View>

        {d.description && (
          <>
            <Text style={s.h2}>{L.description}</Text>
            <Text>{d.description}</Text>
          </>
        )}

        {d.workReport && (
          <>
            <Text style={s.h2}>{L.workReport}</Text>
            <Text>{d.workReport}</Text>
          </>
        )}

        {d.checklist.length > 0 && (
          <>
            <Text style={s.h2}>{L.checklist}</Text>
            {d.checklist.map((c, i) =>
              c.heading ? (
                <Text key={i} style={s.heading}>
                  {c.label}
                </Text>
              ) : (
                <View key={i} style={s.row} wrap={false}>
                  <Text style={{ width: "55%", paddingRight: 8 }}>{c.label}</Text>
                  <View style={{ width: "45%" }}>
                    {c.image ? <Image src={{ data: c.image, format: "png" }} style={{ height: 50, objectFit: "contain" }} /> : <Text>{c.answer}</Text>}
                    {c.note && <Text style={s.muted}>{c.note}</Text>}
                  </View>
                </View>
              ),
            )}
          </>
        )}

        {d.time.length > 0 && (
          <>
            <Text style={s.h2}>{L.time}</Text>
            {d.time.map((e, i) => (
              <View key={i} style={s.row}>
                <Text style={{ width: "30%" }}>{e.who}</Text>
                <Text style={{ width: "25%" }}>{e.when}</Text>
                <Text style={{ width: "30%" }} >{e.note ?? ""}</Text>
                <Text style={{ width: "15%", textAlign: "right" }}>{e.duration}</Text>
              </View>
            ))}
            <View style={[s.row, { borderBottom: 0 }]}>
              <Text style={{ width: "85%", fontFamily: "Helvetica-Bold" }}>{L.total}</Text>
              <Text style={{ width: "15%", textAlign: "right", fontFamily: "Helvetica-Bold" }}>{d.totalTime}</Text>
            </View>
          </>
        )}

        {d.parts.length > 0 && (
          <>
            <Text style={s.h2}>{L.parts}</Text>
            {d.parts.map((p, i) => (
              <View key={i} style={s.row} wrap={false}>
                <View style={{ width: "65%" }}>
                  <Text>{p.name}</Text>
                  {p.serials.length > 0 && <Text style={{ fontSize: 8, color: "#6b7280" }}>{L.serials} {p.serials.join(", ")}</Text>}
                </View>
                <Text style={{ width: "20%", color: "#6b7280" }}>{p.sku ?? ""}</Text>
                <Text style={{ width: "15%", textAlign: "right" }}>{p.qty}</Text>
              </View>
            ))}
          </>
        )}

        {d.photos.length > 0 && (
          <>
            <Text style={s.h2}>{L.photos}</Text>
            <View style={s.photos}>
              {d.photos.map((p, i) => (
                <Image key={i} src={{ data: p, format: p[0] === 0x89 ? "png" : "jpg" }} style={s.photo} />
              ))}
            </View>
          </>
        )}

        {d.signature && (
          <View wrap={false}>
            <Text style={s.h2}>{L.signoff}</Text>
            <Image src={{ data: d.signature.image, format: "png" }} style={{ width: 200, height: 80, objectFit: "contain" }} />
            <Text style={{ marginTop: 4, fontFamily: "Helvetica-Bold" }}>{d.signature.name}</Text>
            <Text style={s.muted}>{d.signature.at}</Text>
          </View>
        )}
        {!d.signature && d.clientAbsent && (
          <View wrap={false}>
            <Text style={s.h2}>{L.signoff}</Text>
            <Text>{L.clientAbsent}</Text>
          </View>
        )}

        <PdfFooter lh={d.lh} label={`${L.reportTitle} #${d.number}`} />
      </Page>
    </Document>
  );
}
