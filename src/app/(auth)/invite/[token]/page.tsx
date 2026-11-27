import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { Button, Card } from "@/components/ui";
import { ACTIVE_ORG_COOKIE } from "@/lib/context";
import { acceptInvitation, pendingInvitation } from "@/lib/invitations";
import { signOutAction } from "../../actions";

export default async function InvitePage({ params }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const t = await getTranslations();
  const invite = await pendingInvitation(token);

  if (!invite) {
    return (
      <Card className="p-6 text-center text-sm">{t("invite.invalid")}</Card>
    );
  }

  const session = await auth();
  const org = invite.organization.name;
  const role = invite.jobRole?.name ?? t(`roles.${invite.role}`);
  const next = `/invite/${token}`;

  async function accept() {
    "use server";
    const s = await auth();
    const orgId = s?.user?.id ? await acceptInvitation(s.user.id, token) : null;
    if (!orgId) redirect(next);
    (await cookies()).set(ACTIVE_ORG_COOKIE, orgId, { path: "/", httpOnly: true, sameSite: "lax" });
    redirect("/dashboard");
  }

  const sessionEmail = session?.user?.email?.toLowerCase();

  return (
    <Card className="p-6">
      <h1 className="text-lg font-semibold">{t("invite.title", { org })}</h1>
      <p className="mb-5 mt-1 text-sm text-muted">{t("invite.description", { org, role })}</p>

      {!session?.user ? (
        <div className="space-y-2">
          <Link href={`/signup?next=${encodeURIComponent(next)}&email=${encodeURIComponent(invite.email)}`}>
            <Button className="w-full">{t("invite.createAccount")}</Button>
          </Link>
          <Link href={`/login?next=${encodeURIComponent(next)}`}>
            <Button variant="secondary" className="w-full">
              {t("auth.signIn")}
            </Button>
          </Link>
        </div>
      ) : sessionEmail !== invite.email ? (
        <div className="space-y-4">
          <p className="text-sm">{t("invite.wrongAccount", { email: invite.email })}</p>
          <form action={signOutAction}>
            <Button variant="secondary" className="w-full">
              {t("common.signOut")}
            </Button>
          </form>
        </div>
      ) : (
        <form action={accept}>
          <Button className="w-full">{t("invite.accept")}</Button>
        </form>
      )}
    </Card>
  );
}
