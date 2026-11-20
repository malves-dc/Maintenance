import { getTranslations } from "next-intl/server";

/** On its own address the Hours section installs as an app of its own (its name and icon), opening on /horas. */
export async function GET() {
  const t = await getTranslations("hours");
  const manifest = {
    id: "/horas",
    name: t("appName"),
    short_name: t("appName"),
    description: t("manifestDescription"),
    start_url: "/horas",
    scope: "/horas",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f7f7f8",
    theme_color: "#1f4f8f",
    icons: [
      { src: "/icons/horas-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/horas-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/horas-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  return new Response(JSON.stringify(manifest), { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "no-cache" } });
}
