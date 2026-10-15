import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Mail, Pencil, Phone, Plus } from "lucide-react";
import { Badge, Button, Card, PageHeader } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { ActionForm, FieldError } from "@/components/action-form";
import { Field, Input } from "@/components/ui";
import { ArchiveButton } from "@/components/archive-button";
import { AnonymizeClientButton, ContactReportsToggle, DeleteContactButton } from "./client";
import { ContractStatusBadge } from "../../contracts/status-badge";
import { getContext } from "@/lib/context";
import { addContactAction, setClientArchivedAction } from "../actions";

export default async function ClientPage({ params }: PageProps<"/clients/[id]">) {
  const { id } = await params;
  const ctx = await getContext();
  if (!ctx.can("internal.view")) notFound();
  const t = await getTranslations();

  const client = await ctx.db.client.findUnique({
    where: { id },
    include: {
      contacts: { orderBy: [{ isPrimary: "desc" }, { name: "asc" }] },
      contracts: { orderBy: { startDate: "desc" }, include: { villa: { select: { name: true } } } },
      villas: {
        where: { archivedAt: null },
        orderBy: { name: "asc" },
        include: { _count: { select: { assets: { where: { archivedAt: null } } } } },
      },
      managedVillas: {
        where: { archivedAt: null },
        orderBy: { name: "asc" },
        include: { client: { select: { id: true, name: true } } },
      },
    },
  });
  if (!client) notFound();
  const canManage = ctx.can("clients.manage");

  return (
    <>
      <BackLink href="/clients" label={t("nav.clients")} />
      <PageHeader
        title={client.name}
        description={t(`clientType.${client.type}`)}
        actions={
          canManage && (
            <>
              {client.archivedAt && !client.anonymizedAt && <AnonymizeClientButton clientId={client.id} />}
              <ArchiveButton archived={!!client.archivedAt} action={setClientArchivedAction.bind(null, client.id)} />
              <Link href={`/clients/${client.id}/edit`}>
                <Button variant="secondary">
                  <Pencil className="size-4" />
                  {t("common.edit")}
                </Button>
              </Link>
            </>
          )
        }
      />
      {client.archivedAt && <Badge className="mb-4">{client.anonymizedAt ? t("erasure.erased") : t("common.archived")}</Badge>}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card>
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 className="font-medium">{t("nav.villas")}</h2>
              {canManage && (
                <Link href={`/villas/new?clientId=${client.id}`}>
                  <Button size="sm" variant="secondary">
                    <Plus className="size-4" />
                    {t("villas.new")}
                  </Button>
                </Link>
              )}
            </div>
            {client.villas.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted">{t("villas.empty")}</p>
            ) : (
              <ul className="divide-y divide-border">
                {client.villas.map((v) => (
                  <li key={v.id}>
                    <Link href={`/villas/${v.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50">
                      <span>
                        <span className="font-medium">{v.name}</span>
                        {v.code && <span className="ml-2 font-mono text-xs text-muted">{v.code}</span>}
                        <span className="block text-xs text-muted">{[v.city, v.country].filter(Boolean).join(", ")}</span>
                      </span>
                      <span className="text-sm text-muted">{t("assets.count", { count: v._count.assets })}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {client.managedVillas.length > 0 && (
            <Card>
              <div className="border-b border-border px-5 py-3">
                <h2 className="font-medium">{t("villas.managedVillas")}</h2>
                <p className="text-xs text-muted">{t("villas.managedVillasHint")}</p>
              </div>
              <ul className="divide-y divide-border">
                {client.managedVillas.map((v) => (
                  <li key={v.id}>
                    <Link href={`/villas/${v.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-gray-50">
                      <span>
                        <span className="font-medium">{v.name}</span>
                        {v.code && <span className="ml-2 font-mono text-xs text-muted">{v.code}</span>}
                        <span className="block text-xs text-muted">{[v.city, v.country].filter(Boolean).join(", ")}</span>
                      </span>
                      {v.client && <span className="text-right text-sm text-muted">{t("villas.ownedBy", { name: v.client.name })}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 className="font-medium">{t("nav.contracts")}</h2>
              {ctx.can("contracts.manage") && (
                <Link href={`/contracts/new?clientId=${client.id}`}>
                  <Button size="sm" variant="secondary">
                    <Plus className="size-4" />
                    {t("contracts.new")}
                  </Button>
                </Link>
              )}
            </div>
            {client.contracts.length === 0 ? (
              <p className="px-5 py-4 text-sm text-muted">{t("contracts.noneForClient")}</p>
            ) : (
              <ul className="divide-y divide-border">
                {client.contracts.map((c) => (
                  <li key={c.id}>
                    <Link href={`/contracts/${c.id}`} className="flex items-center justify-between gap-2 px-5 py-3 hover:bg-gray-50">
                      <span className="min-w-0">
                        <span className="block font-medium">{c.name}</span>
                        <span className="block text-xs text-muted">
                          {c.villa?.name ?? t("contracts.allVillas")}
                          {(c.responseTimeHours || c.resolutionTimeHours) &&
                            ` · ${t("contracts.slaShort", { response: c.responseTimeHours ?? "—", resolution: c.resolutionTimeHours ?? "—" })}`}
                        </span>
                      </span>
                      <ContractStatusBadge status={c.status} endDate={c.endDate} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {client.notes && (
            <Card className="p-5">
              <h2 className="mb-2 font-medium">{t("common.notes")}</h2>
              <p className="whitespace-pre-wrap text-sm">{client.notes}</p>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card className="space-y-2 p-5 text-sm">
            {client.email && (
              <a href={`mailto:${client.email}`} className="flex items-center gap-2 hover:text-brand">
                <Mail className="size-4 text-muted" />
                {client.email}
              </a>
            )}
            {client.phone && (
              <a href={`tel:${client.phone}`} className="flex items-center gap-2 hover:text-brand">
                <Phone className="size-4 text-muted" />
                {client.phone}
              </a>
            )}
            {client.taxId && (
              <div>
                <span className="text-muted">{t("clients.taxId")}:</span> {client.taxId}
              </div>
            )}
            {client.billingAddress && <div className="whitespace-pre-wrap text-muted">{client.billingAddress}</div>}
            {!client.email && !client.phone && !client.taxId && !client.billingAddress && (
              <span className="text-muted">—</span>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 font-medium">{t("clients.contacts")}</h2>
            <ul className="mb-4 space-y-3">
              {client.contacts.map((c) => (
                <li key={c.id} className="flex items-start justify-between gap-2 text-sm">
                  <div>
                    <div className="font-medium">
                      {c.name} {c.isPrimary && <Badge className="ml-1">{t("clients.primary")}</Badge>}
                    </div>
                    {c.role && <div className="text-xs text-muted">{c.role}</div>}
                    {c.phone && (
                      <a href={`tel:${c.phone}`} className="block text-xs hover:text-brand">
                        {c.phone}
                      </a>
                    )}
                    {c.email && (
                      <a href={`mailto:${c.email}`} className="block text-xs hover:text-brand">
                        {c.email}
                      </a>
                    )}
                    {c.email && canManage && <ContactReportsToggle clientId={client.id} contactId={c.id} on={c.receivesReports} />}
                    {c.email && !canManage && c.receivesReports && <div className="text-xs text-muted">{t("reportEmail.contactOn")}</div>}
                  </div>
                  {canManage && <DeleteContactButton clientId={client.id} contactId={c.id} />}
                </li>
              ))}
              {client.contacts.length === 0 && <li className="text-sm text-muted">—</li>}
            </ul>
            {client.reportEmails.length > 0 && (
              <p className="mb-4 text-xs text-muted">
                {t("reportEmail.clientEmails")}: {client.reportEmails.join(", ")}
              </p>
            )}
            {canManage && (
              <details className="rounded-md border border-border p-3 [&_summary]:cursor-pointer">
                <summary className="text-sm font-medium">{t("clients.addContact")}</summary>
                <ActionForm action={addContactAction.bind(null, client.id)} submitLabel={t("common.add")} className="mt-3">
                  <Field label={t("common.name")}>
                    <Input name="name" required />
                    <FieldError name="name" />
                  </Field>
                  <Field label={t("clients.contactRole")}>
                    <Input name="role" placeholder={t("clients.contactRolePlaceholder")} />
                  </Field>
                  <Field label={t("common.phone")}>
                    <Input name="phone" type="tel" />
                  </Field>
                  <Field label={t("common.email")}>
                    <Input name="email" type="email" />
                  </Field>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="receivesReports" className="size-4 accent-brand" />
                    {t("reportEmail.contactCheckbox")}
                  </label>
                </ActionForm>
              </details>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
