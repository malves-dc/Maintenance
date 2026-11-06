import { getFormatter, getTranslations } from "next-intl/server";
import { Card } from "@/components/ui";
import type { Villa } from "@/generated/prisma/client";
import { checkConnectivityAction } from "../actions";
import { ConnectivityBadge } from "../connectivity-badge";
import { CheckConnectivityButton } from "./check-connectivity-button";

type Props = Pick<
  Villa,
  | "id"
  | "connectivityType"
  | "connectivityHost"
  | "connectivityPort"
  | "connectivityVpn"
  | "online"
  | "onlineCheckedAt"
  | "onlineSince"
  | "onlineLatencyMs"
  | "onlineAddress"
  | "onlineError"
>;

/** Villa page: the internet connection (DynDNS / VPN) and its last check. */
export async function ConnectivityCard({ villa, canEdit }: { villa: Props; canEdit: boolean }) {
  const t = await getTranslations("connectivity");
  const format = await getFormatter();
  const monitored = !!villa.connectivityType && !!villa.connectivityHost;

  return (
    <Card className="space-y-3 p-5 text-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-medium">{t("title")}</h2>
        {monitored && <ConnectivityBadge online={villa.online} />}
      </div>
      {!monitored ? (
        <p className="text-muted">{canEdit ? t("notMonitoredEdit") : t("notMonitored")}</p>
      ) : (
        <>
          <div>
            <div className="text-xs text-muted">{t(villa.connectivityType!)}</div>
            {villa.connectivityVpn && <div>{villa.connectivityVpn}</div>}
            <div className="break-all font-mono text-xs">
              {villa.connectivityHost}
              {villa.connectivityPort && `:${villa.connectivityPort}`}
            </div>
            <div className="text-xs text-muted">{villa.connectivityPort ? t("viaTcp", { port: villa.connectivityPort }) : t("viaPing")}</div>
          </div>
          {villa.onlineCheckedAt && (
            <dl className="space-y-1 text-xs">
              {villa.onlineSince && (
                <div className="flex justify-between gap-2">
                  <dt className="text-muted">{villa.online ? t("onlineSince") : t("offlineSince")}</dt>
                  <dd title={format.dateTime(villa.onlineSince, { dateStyle: "short", timeStyle: "short" })}>
                    {format.relativeTime(villa.onlineSince)}
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-2">
                <dt className="text-muted">{t("lastCheck")}</dt>
                <dd title={format.dateTime(villa.onlineCheckedAt, { dateStyle: "short", timeStyle: "medium" })}>
                  {format.relativeTime(villa.onlineCheckedAt)}
                </dd>
              </div>
              {villa.onlineLatencyMs != null && (
                <div className="flex justify-between gap-2">
                  <dt className="text-muted">{t("latency")}</dt>
                  <dd className="tabular-nums">{t("ms", { ms: villa.onlineLatencyMs })}</dd>
                </div>
              )}
              {villa.onlineAddress && villa.onlineAddress !== villa.connectivityHost && (
                <div className="flex justify-between gap-2">
                  <dt className="text-muted">{t("address")}</dt>
                  <dd className="font-mono">{villa.onlineAddress}</dd>
                </div>
              )}
            </dl>
          )}
          {villa.onlineError && (
            <p className={villa.online ? "text-xs text-muted" : "text-xs text-red-700"}>{t(`error.${villa.onlineError}`)}</p>
          )}
          <CheckConnectivityButton action={checkConnectivityAction.bind(null, villa.id)} />
        </>
      )}
    </Card>
  );
}
