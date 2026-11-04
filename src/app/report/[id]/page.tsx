import { getContext } from "@/lib/context";
import { titled } from "@/lib/metadata";
import { brandStyle } from "@/lib/branding";
import { BackButton } from "./back-button";
import { ReportFrame } from "./report-frame";

export const generateMetadata = titled("report.title");

/**
 * The service report PDF framed in a page of our own, so it can carry a way back. Opened full-screen (the installed
 * app on iOS has no browser chrome), a bare PDF would leave no way out but quitting the app. The PDF route does the
 * access checks.
 */
export default async function ReportViewerPage({ params }: PageProps<"/report/[id]">) {
  const { id } = await params;
  const ctx = await getContext();
  const fallback = ctx.role === "REQUESTER" ? "/portal" : `/work-orders/${id}`;
  return (
    <div className="fixed inset-0 bg-gray-100" style={brandStyle(ctx.organization)}>
      <ReportFrame src={`/work-orders/${id}/report`} title={id} />
      <BackButton fallback={fallback} />
    </div>
  );
}
