import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { CalendarCheck, CalendarClock, Camera, PhoneCall } from "lucide-react";
import { Card, PageHeader, Select, Table } from "@/components/ui";
import { FilterBar, Pagination } from "@/components/list-controls";
import { EmptyState } from "@/components/empty-state";
import { PriorityText, SystemBadge } from "@/components/badges";
import { RequestStatusBadge } from "@/components/request-badge";
import { getContext } from "@/lib/context";
import { pageOf, PAGE_SIZE, sp } from "@/lib/list";
import { cn } from "@/lib/utils";
import { RequestStatus } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { titled } from "@/lib/metadata";

export const generateMetadata = titled("nav.requests");

export default async function RequestsPage({ searchParams }: PageProps<"/requests">) {
  const ctx = await getContext();
  if (!ctx.can("internal.view")) notFound();
  const t = await getTranslations();
  const format = await getFormatter();
  const params = await searchParams;
  const status = sp(params, "status") ?? "PENDING";
  const q = sp(params, "q");
  const { page, skip, take } = pageOf(params);

  const where: Prisma.RequestWhereInput = {
    ...(status in RequestStatus ? { status: status as RequestStatus } : {}),
    ...(sp(params, "villaId") ? { villaId: sp(params, "villaId") } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
            { requesterName: { contains: q, mode: "insensitive" } },
            ...(Number.isInteger(Number(q.replace(/^#/, ""))) ? [{ number: Number(q.replace(/^#/, "")) }] : []),
          ],
        }
      : {}),
  };
  const [requests, total, counts, villas] = await Promise.all([
    ctx.db.request.findMany({
      where,
      include: {
        villa: { select: { name: true } },
        asset: { select: { name: true } },
        requester: { select: { name: true } },
        onCallUsers: { select: { name: true }, orderBy: { name: "asc" } },
        _count: { select: { attachments: true } },
      },
      orderBy: [{ createdAt: "desc" }],
      skip,
      take,
    }),
    ctx.db.request.count({ where }),
    ctx.db.request.groupBy({ by: ["status"], _count: true }),
    ctx.db.villa.findMany({ where: { archivedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const countOf = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  const tabHref = (s: string) => {
    const qp = new URLSearchParams(Object.entries(params).filter(([k, v]) => typeof v === "string" && k !== "status" && k !== "page") as [string, string][]);
    if (s !== "PENDING") qp.set("status", s);
    return `/requests${qp.size ? `?${qp}` : ""}`;
  };

  return (
    <>
      <PageHeader title={t("nav.requests")} description={t("requests.description")} />
      <div className="mb-3 flex flex-wrap gap-1 border-b border-border">
        {[...Object.values(RequestStatus), "all"].map((s) => (
          <Link
            key={s}
            href={tabHref(s)}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm",
              status === s ? "border-brand font-medium text-brand" : "border-transparent text-muted hover:text-foreground",
            )}
          >
            {s === "all" ? t("requests.all") : t(`requestStatus.${s}`)}
            {s !== "all" && <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 text-xs">{countOf(s)}</span>}
          </Link>
        ))}
      </div>
      <FilterBar searchPlaceholder={t("requests.searchPlaceholder")}>
        {status !== "PENDING" && <input type="hidden" name="status" value={status} />}
        <Select name="villaId" defaultValue={sp(params, "villaId") ?? ""}>
          <option value="">{t("assets.allVillas")}</option>
          {villas.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </Select>
      </FilterBar>

      {requests.length === 0 ? (
        <EmptyState title={status === "PENDING" ? t("requests.nonePending") : t("common.noResults")} description={t("requests.howTo")} />
      ) : (
        <Card>
          <Table>
            <thead>
              <tr>
                <th>{t("wo.title")}</th>
                <th className="hidden md:table-cell">{t("assets.location")}</th>
                <th>{t("requests.from")}</th>
                <th>{t("requests.received")}</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td>
                    <Link href={`/requests/${r.id}`} className="font-medium hover:text-brand">
                      <span className="mr-1.5 font-mono text-xs text-muted">R{r.number}</span>
                      {r.title}
                    </Link>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2">
                      {status === "all" && <RequestStatusBadge status={r.status} />}
                      {r.system && <SystemBadge system={r.system} />}
                      <PriorityText priority={r.priority} />
                      {r._count.attachments > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-xs text-muted">
                          <Camera className="size-3.5" />
                          {r._count.attachments}
                        </span>
                      )}
                      {r.scheduledFor ? (
                        <span className="inline-flex items-center gap-0.5 text-xs text-green-700" title={t("requests.visitLabel")}>
                          <CalendarCheck className="size-3.5" />
                          {format.dateTime(r.scheduledFor, { dateStyle: "short", timeStyle: "short" })}
                        </span>
                      ) : (
                        r.availableFrom &&
                        r.availableTo && (
                          <span className="inline-flex items-center gap-0.5 text-xs text-amber-700" title={t("requests.windowLabel")}>
                            <CalendarClock className="size-3.5" />
                            {format.dateTimeRange(r.availableFrom, r.availableTo, { dateStyle: "short", timeStyle: "short" })}
                          </span>
                        )
                      )}
                      {r.onCallUsers.length > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-xs text-muted" title={t("onCall.requestOnCall")}>
                          <PhoneCall className="size-3.5" />
                          {r.onCallUsers.map((u) => u.name).join(", ")}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="hidden md:table-cell">
                    {r.villa?.name ?? "—"}
                    {r.asset && <div className="text-xs text-muted">{r.asset.name}</div>}
                  </td>
                  <td>
                    {r.requester?.name ?? r.requesterName ?? "—"}
                    {!r.requesterId && <div className="text-xs text-muted">{t("requests.viaQr")}</div>}
                  </td>
                  <td className="whitespace-nowrap text-muted">{format.relativeTime(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} />
    </>
  );
}
