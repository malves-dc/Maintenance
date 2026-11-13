import { auth } from "@/auth";
import { auditUser } from "@/lib/audit";
import { exportUserData } from "@/lib/personal-data";

// "Download my data" on the profile page. Logged in each of the person's companies (GDPR art. 32: who took
// personal data out of the system, and when).
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  const data = await exportUserData(session.user.id);
  await auditUser(session.user.id, "account.export");
  const day = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="my-data-${day}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
