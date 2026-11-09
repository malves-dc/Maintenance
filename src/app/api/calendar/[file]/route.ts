import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db/client";
import { buildCalendar, eventTimes, type IcsEvent } from "@/lib/ics";
import { appOrigin } from "@/lib/qr";
import { docRef } from "@/lib/series";

// Personal calendar feed: /api/calendar/<token>.ics, subscribed to in Google Calendar, Outlook or Apple Calendar.
// The secret token in the URL is the only credential (calendar apps can't sign in); the user can replace it from
// their profile, which cuts off the old link. Only work orders assigned to the user, in companies they still
// belong to as staff, from 60 days ago to a year ahead.

const PAST_DAYS = 60;
const FUTURE_DAYS = 366;

export async function GET(_req: Request, { params }: RouteContext<"/api/calendar/[file]">) {
  const { file } = await params;
  const token = file.replace(/\.ics$/i, "");
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return new Response("Not found", { status: 404 });
  const user = await prisma.user.findUnique({ where: { calendarToken: token }, select: { id: true, name: true, locale: true, erasedAt: true } });
  if (!user || user.erasedAt) return new Response("Not found", { status: 404 });

  const now = Date.now();
  const from = new Date(now - PAST_DAYS * 86_400_000);
  const to = new Date(now + FUTURE_DAYS * 86_400_000);
  const wos = await prisma.workOrder.findMany({
    where: {
      assignees: { some: { userId: user.id } },
      organization: { memberships: { some: { userId: user.id, active: true, role: { not: "REQUESTER" } } } },
      OR: [{ startDate: { gte: from, lt: to } }, { dueDate: { gte: from, lt: to } }],
    },
    select: {
      id: true,
      year: true, number: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      startDate: true,
      dueDate: true,
      updatedAt: true,
      villa: { select: { name: true, address: true, city: true } },
      asset: { select: { name: true } },
      organization: { select: { name: true } },
    },
    orderBy: { dueDate: "asc" },
    take: 2000,
  });

  const t = await getTranslations({ locale: user.locale === "pt" ? "pt" : "en" });
  const origin = await appOrigin();
  const events: IcsEvent[] = [];
  for (const w of wos) {
    const slot = eventTimes(w);
    if (!slot) continue;
    const place = w.villa && [w.villa.name, w.villa.address, w.villa.city].filter(Boolean).join(", ");
    const link = `${origin}/work-orders/${w.id}`;
    events.push({
      uid: `wo-${w.id}@villaops`,
      ...slot,
      summary: `${w.status === "DONE" ? "✓ " : ""}${docRef(w)} ${w.title}${w.villa ? ` — ${w.villa.name}` : ""}`,
      location: place,
      description: [
        `${t(`woStatus.${w.status}`)} · ${t(`priority.${w.priority}`)}`,
        w.asset?.name ?? null,
        w.description?.slice(0, 1000) ?? null,
        link,
      ]
        .filter(Boolean)
        .join("\n\n"),
      url: link,
      updated: w.updatedAt,
      cancelled: w.status === "CANCELLED",
    });
  }

  const org = wos[0]?.organization.name;
  return new Response(buildCalendar({ name: `${org ?? "VillaOps"} — ${user.name}`, events }), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="work-orders.ics"',
      "Cache-Control": "private, max-age=300",
    },
  });
}
