import { redirect } from "next/navigation";
import { getContext } from "@/lib/context";
import { brandStyle, logoSrc } from "@/lib/branding";
import { getTheme } from "@/lib/theme-server";
import { FieldApp } from "./field-app";
import { titled } from "@/lib/metadata";

export const generateMetadata = titled("nav.field");

/**
 * The offline field app for technicians. The service worker keeps this page (and its scripts) so it
 * opens without a connection; everything else happens client-side against IndexedDB.
 */
export default async function FieldPage() {
  const ctx = await getContext();
  if (ctx.role === "REQUESTER") redirect("/portal");
  if (!ctx.can("workOrders.execute") || !ctx.can("internal.view")) redirect("/dashboard");
  return (
    <div style={brandStyle(ctx.organization)}>
      <FieldApp user={{ id: ctx.user.id, name: ctx.user.name }} org={ctx.organization.name} logo={logoSrc(ctx.organization)} theme={await getTheme()} />
    </div>
  );
}
