import { getTranslations } from "next-intl/server";

/**
 * The Hours section's own home-screen icon: installed from any /hours page it opens straight on the hours. It is the
 * same app (scope "/"), so the menu and every other section work from it too.
 */
export async function GET() {
  const t = await getTranslations();
  const manifest = {
    id: "/hours",
    name: t("nav.hours"),
    short_name: t("nav.hours"),
    description: t("hours.description"),
    start_url: "/hours",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f7f7f8",
    theme_color: "#1f4f8f",
    icons: [
      { src: "/icons/hours-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/hours-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/hours-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  return new Response(JSON.stringify(manifest), { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "no-cache" } });
}
