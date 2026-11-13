import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Button, Card } from "@/components/ui";
import { requireUser } from "@/lib/context";
import { getAppName } from "@/lib/server-settings";
import { pendingSetup, twoFactorRequiredFor } from "@/lib/two-factor";
import { signOutAction } from "../actions";
import { TwoFactorSetup } from "./forms";

// Setting up two-factor sign-in. Staff whose company requires it are sent here by getContext() until they do.
export default async function TwoFactorPage() {
  const user = await requireUser();
  if (user.totpEnabledAt) redirect("/dashboard");
  const t = await getTranslations("twoFactor");
  const required = await twoFactorRequiredFor(user.id);
  const { secret, qr } = await pendingSetup(user, await getAppName());
  return (
    <Card className="p-6">
      <h1 className="text-lg font-semibold">{t("setupTitle")}</h1>
      <p className="mb-5 mt-1 text-sm text-muted">{required ? t("setupIntro") : t("setupIntroOptional")}</p>
      <TwoFactorSetup qr={qr} secret={secret} />
      {required && (
        <form action={signOutAction} className="mt-4 text-center">
          <Button variant="ghost" size="sm">
            {t("signOut")}
          </Button>
        </form>
      )}
    </Card>
  );
}
