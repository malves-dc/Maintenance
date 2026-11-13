import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Badge, Card, PageHeader, Table } from "@/components/ui";
import { EmptyState } from "@/components/empty-state";
import { getContext } from "@/lib/context";
import { titled } from "@/lib/metadata";
import { InviteForm, MemberControls, RevokeInviteButton } from "../users/client";
import { MemberName } from "../users/name-editor";

export const generateMetadata = titled("nav.clientUsers");

// Settings → Clients: client-portal users (villa owners and property managers). Staff are in Settings → Staff.
export default async function ClientUsersPage() {
  const ctx = await getContext();
  if (!ctx.can("users.manage")) notFound();
  const t = await getTranslations();
  const format = await getFormatter();

  const [members, invites, clients] = await Promise.all([
    ctx.db.membership.findMany({
      where: { role: "REQUESTER" },
      include: { user: true, client: { select: { id: true, name: true, _count: { select: { villas: true, managedVillas: true } } } } },
      orderBy: [{ active: "desc" }, { createdAt: "asc" }],
    }),
    ctx.db.invitation.findMany({
      where: { acceptedAt: null, expiresAt: { gt: new Date() }, role: "REQUESTER" },
      orderBy: { createdAt: "desc" },
    }),
    ctx.db.client.findMany({ where: { archivedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const clientName = new Map(clients.map((c) => [c.id, c.name]));

  return (
    <>
      <PageHeader title={t("settings.clientUsersTitle")} description={t("settings.clientUsersDescription")} />

      <Card className="mb-6 p-5">
        <h2 className="mb-1 font-medium">{t("settings.invite")}</h2>
        <p className="mb-4 text-xs text-muted">{t("settings.clientHint")}</p>
        <InviteForm clients={clients} />
      </Card>

      {members.length === 0 ? (
        <EmptyState title={t("settings.noClientUsers")} description={t("settings.clientUsersDescription")} />
      ) : (
        <Card>
          <Table>
            <thead>
              <tr>
                <th>{t("common.name")}</th>
                <th>{t("settings.client")}</th>
                <th>{t("common.status")}</th>
                <th className="text-right">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className={m.active ? "" : "opacity-60"}>
                  <td>
                    {m.user.erasedAt ? <div className="font-medium">{m.user.name}</div> : <MemberName id={m.id} name={m.user.name} />}
                    {!m.user.erasedAt && <div className="text-xs text-muted">{m.user.email}</div>}
                  </td>
                  <td>
                    {m.client ? (
                      <>
                        <Link href={`/clients/${m.client.id}`} className="hover:text-brand">
                          {m.client.name}
                        </Link>
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          {m.client._count.villas > 0 && <Badge>{t("settings.villaOwner", { count: m.client._count.villas })}</Badge>}
                          {m.client._count.managedVillas > 0 && <Badge>{t("settings.propertyManager", { count: m.client._count.managedVillas })}</Badge>}
                        </div>
                      </>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td>
                    <Badge className={m.active ? "bg-green-50 text-green-700" : ""}>
                      {m.user.erasedAt ? t("erasure.erased") : m.active ? t("common.active") : t("common.inactive")}
                    </Badge>
                  </td>
                  <td className="text-right">{!m.user.erasedAt && <MemberControls id={m.id} active={m.active} />}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      {invites.length > 0 && (
        <Card className="mt-6">
          <h2 className="px-4 pt-4 font-medium">{t("settings.pendingInvites")}</h2>
          <Table>
            <thead>
              <tr>
                <th>{t("common.email")}</th>
                <th>{t("settings.client")}</th>
                <th>{t("settings.expires")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {invites.map((i) => (
                <tr key={i.id}>
                  <td>{i.email}</td>
                  <td>{(i.clientId && clientName.get(i.clientId)) ?? "—"}</td>
                  <td className="text-muted">{format.relativeTime(i.expiresAt)}</td>
                  <td className="text-right">
                    <RevokeInviteButton id={i.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </>
  );
}
