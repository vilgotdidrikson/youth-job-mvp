import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "MatchnWork – Ditt första jobb börjar här.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Shared link preview (iMessage, Snapchat, Instagram and others). Rendered once at build time.
export default async function OpenGraphImage() {
  const mark = `data:image/png;base64,${(await readFile(join(process.cwd(), "public/brand/matchnwork-logo.png"))).toString("base64")}`;
  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", height: "100%", padding: "72px 80px", color: "#ffffff", background: "radial-gradient(circle at 85% 15%, #b84164 0%, rgba(184,65,100,0) 55%), radial-gradient(circle at 10% 110%, #dc6f8d 0%, rgba(220,111,141,0) 45%), #241419" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <img src={mark} width={76} height={76} alt="" />
          <span style={{ fontSize: 44, fontWeight: 600, letterSpacing: "-0.04em" }}>MatchnWork</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 96, fontWeight: 600, letterSpacing: "-0.05em", lineHeight: 1.02 }}>Ditt första jobb</span>
          <span style={{ fontSize: 96, fontWeight: 600, letterSpacing: "-0.05em", lineHeight: 1.02, color: "#f3a9be" }}>börjar här.</span>
          <span style={{ marginTop: 34, fontSize: 36, color: "#f6dbe3" }}>En enklare väg från nyfiken till anställd.</span>
        </div>
      </div>
    ),
    size,
  );
}
