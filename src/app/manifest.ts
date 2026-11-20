import type { MetadataRoute } from "next";
import { getAppName } from "@/lib/server-settings";

/** Installable app. It opens on the field app, which works offline; the full app is one tap away. */
export const dynamic = "force-dynamic"; // the name is a server setting

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const name = await getAppName();
  return {
    id: "/m",
    name,
    short_name: name.length > 12 ? name.split(/\s+/)[0].slice(0, 12) : name,
    description: "Maintenance for villa technical systems — works offline in the field.",
    start_url: "/m",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f7f7f8",
    theme_color: "#1f4f8f",
    icons: [
      { src: "/icons/192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "My work", url: "/m" },
      { name: "Scan", url: "/scan" },
      { name: "Hours", url: "/hours" },
      { name: "Dashboard", url: "/dashboard" },
    ],
  };
}
