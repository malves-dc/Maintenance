import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { pendingInvitationFor } from "@/lib/invitations";
import { Card } from "@/components/ui";
import { requireUser } from "@/lib/context";
import { signupOpen } from "@/lib/signup";
import { OnboardingForm } from "./form";

export default async function OnboardingPage() {
  const user = await requireUser();
  // Invited but not yet accepted (e.g. left the invite page before clicking Accept): send them back to it.
  const invite = await pendingInvitationFor(user.email);
  if (invite) redirect(`/invite/${invite.token}`);
  const t = await getTranslations("onboarding");
  // With sign-up closed nobody can create a company here; they need an invitation.
  const open = await signupOpen();
  return (
    <Card className="p-6">
      <h1 className="text-lg font-semibold">{open ? t("title") : t("closedTitle")}</h1>
      <p className="mb-5 mt-1 text-sm text-muted">{open ? t("description") : t("closed")}</p>
      {open && <OnboardingForm />}
    </Card>
  );
}
