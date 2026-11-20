import { ImageResponse } from "next/og";

// App icons, drawn at request time (no binary files in the repo). Public: the proxy skips *.png.
const ICONS: Record<string, { size: number; pad: number; radius: number; mono?: boolean; hours?: boolean }> = {
  "192.png": { size: 192, pad: 0, radius: 36 },
  "512.png": { size: 512, pad: 0, radius: 96 },
  "maskable.png": { size: 512, pad: 0, radius: 0 }, // full bleed; the glyph stays inside the safe zone
  "apple.png": { size: 180, pad: 0, radius: 0 },
  "badge.png": { size: 96, pad: 0, radius: 0, mono: true }, // Android status-bar badge: white on transparent
  // The Hours app (/horas on its own address): a clock, in the app's colours.
  "horas-192.png": { size: 192, pad: 0, radius: 36, hours: true },
  "horas-512.png": { size: 512, pad: 0, radius: 96, hours: true },
  "horas-maskable.png": { size: 512, pad: 0, radius: 0, hours: true },
  "horas-apple.png": { size: 180, pad: 0, radius: 0, hours: true },
};

/** A clock face, as an inline SVG (ImageResponse draws SVG images). */
function clock(size: number) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5"/><path d="M12 6.5V12l3.6 2.2"/></svg>`;
  // eslint-disable-next-line @next/next/no-img-element
  return <img alt="" width={size} height={size} src={`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`} />;
}

export async function GET(_req: Request, { params }: RouteContext<"/icons/[file]">) {
  const { file } = await params;
  const spec = ICONS[file];
  if (!spec) return new Response("Not found", { status: 404 });
  const { size, radius, mono } = spec;
  const glyph = Math.round(size * (file === "maskable.png" ? 0.42 : 0.56));
  if (spec.hours) {
    return new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#1f4f8f", borderRadius: radius }}>
          {clock(Math.round(size * (file === "horas-maskable.png" ? 0.5 : 0.66)))}
        </div>
      ),
      { width: size, height: size, headers: { "Cache-Control": "public, max-age=86400" } },
    );
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: mono ? "transparent" : "#1f4f8f",
          borderRadius: radius,
          color: "#ffffff",
          fontSize: glyph,
          fontWeight: 700,
          letterSpacing: -glyph * 0.04,
        }}
      >
        V
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=86400" } },
  );
}
