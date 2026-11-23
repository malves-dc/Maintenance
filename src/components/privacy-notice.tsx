import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui";
import { companyLines, logoSrc, type LogoOrg } from "@/lib/branding";
import { paragraphs, PRIVACY_SECTIONS } from "@/lib/privacy";
import { parseRetention, retentionNoticeLines } from "@/lib/retention-rules";

type Org = LogoOrg & {
  retention: unknown;
  name: string;
  legalName: string | null;
  taxId: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  privacyNotice: string | null;
};

/** The company's own notice, or the built-in template filled with its details. */
export async function PrivacyNotice({ org }: { org: Org }) {
  const t = await getTranslations();
  const logo = logoSrc(org);
  const company = org.legalName || org.name;
  const contact = [org.email, org.phone].filter(Boolean).join(" · ") || t("privacy.contactFallback");
  return (
    <Card className="w-full max-w-2xl p-6 sm:p-8">
      <div className="mb-6 border-b border-border pb-5">
        {logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" className="mb-3 h-12 max-w-40 object-contain" />
        )}
        <div className="text-xs font-semibold uppercase tracking-wide text-brand">{org.name}</div>
        <h1 className="mt-1 text-xl font-semibold">{t("privacy.title")}</h1>
        <div className="mt-2 space-y-0.5 text-xs text-muted">
          {companyLines(org, t("company.taxId")).map((l) => (
            <div key={l}>{l}</div>
          ))}
        </div>
      </div>
      <div className="space-y-4 text-sm leading-relaxed">
        {org.privacyNotice ? (
          paragraphs(org.privacyNotice).map((p, i) => (
            <p key={i} className="whitespace-pre-line">
              {p}
            </p>
          ))
        ) : (
          PRIVACY_SECTIONS.map((s) => (
            <section key={s}>
              <h2 className="mb-1 font-medium">{t(`privacy.default.${s}.title`)}</h2>
              <p className="whitespace-pre-line text-muted">{t(`privacy.default.${s}.body`, { company, contact })}</p>
              {/* The company's own periods (Settings → Organization), so the notice says what the system really does. */}
              {s === "retention" && (
                <>
                  <p className="mt-2 text-muted">{t("privacy.default.retention.periods")}</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted">
                    {retentionNoticeLines(parseRetention(org.retention)).map((l) => (
                      <li key={l.key}>{t(`privacy.default.retention.${l.key}`, { n: l.n })}</li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          ))
        )}
      </div>
    </Card>
  );
}
