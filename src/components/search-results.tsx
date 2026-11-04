import { useFormatter, useTranslations } from "next-intl";
import { MessageSquare, ListChecks, Clock, ArrowRightLeft, FileText, ClipboardCheck, Inbox, type LucideIcon } from "lucide-react";
import { SystemBadge, WorkOrderStatusBadge } from "@/components/badges";
import type { HitKind, SearchResult } from "@/lib/search";
import type { Range } from "@/lib/search-text";

// Search results (lib/search.ts), shared by /search and the field app: each work order with the notes
// where the words were found, highlighted.

const KIND_ICON: Record<HitKind, LucideIcon> = {
  description: FileText,
  workReport: ClipboardCheck,
  request: Inbox,
  comment: MessageSquare,
  itemNote: ListChecks,
  itemAnswer: ListChecks,
  timeNote: Clock,
  statusNote: ArrowRightLeft,
};

export function Highlighted({ text, marks }: { text: string; marks: Range[] }) {
  const parts: React.ReactNode[] = [];
  let at = 0;
  marks.forEach(([s, e], i) => {
    if (s > at) parts.push(text.slice(at, s));
    parts.push(
      <mark key={i} className="rounded-sm bg-amber-200 px-0.5 text-inherit">
        {text.slice(s, e)}
      </mark>,
    );
    at = e;
  });
  if (at < text.length) parts.push(text.slice(at));
  return <>{parts}</>;
}

export function SearchResults({
  results,
  linkFor,
  compact = false,
}: {
  results: SearchResult[];
  /** Where a result opens: the web page, or the field app's own view of the job. */
  linkFor: (id: string) => string;
  /** Field app: no system badge, smaller spacing. */
  compact?: boolean;
}) {
  const t = useTranslations("search");
  const tStatus = useTranslations("woStatus");
  const format = useFormatter();
  const date = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "medium" });

  return (
    <ul className="space-y-3">
      {results.map((r) => (
        <li key={r.id} className="rounded-lg border border-border bg-surface">
          <a href={linkFor(r.id)} className="block rounded-t-lg px-4 pb-2 pt-3 hover:bg-gray-50">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted">#{r.number}</span>
              <WorkOrderStatusBadge status={r.status} />
              {!compact && r.system && <SystemBadge system={r.system} />}
              <span className="ml-auto text-xs text-muted">{r.completedAt ? t("completedOn", { date: date(r.completedAt) }) : t("openedOn", { date: date(r.createdAt) })}</span>
            </div>
            <div className="mt-1 font-medium text-brand">
              <Highlighted text={r.title} marks={r.titleMarks} />
            </div>
            {(r.villa || r.asset) && <div className="mt-0.5 truncate text-xs text-muted">{[r.villa, r.asset].filter(Boolean).join(" · ")}</div>}
          </a>
          {r.hits.length > 0 && (
            <ul className={compact ? "space-y-2 px-4 pb-3" : "space-y-2.5 px-4 pb-3"}>
              {r.hits.map((h) => {
                const Icon = KIND_ICON[h.kind];
                const where =
                  h.kind === "itemNote" || h.kind === "itemAnswer"
                    ? t(`kind.${h.kind}`, { step: h.label ?? "" })
                    : h.kind === "statusNote" && h.label
                      ? t("kind.statusNote", { status: tStatus(h.label as never) })
                      : t(`kind.${h.kind}`);
                return (
                  <li key={`${h.kind}:${h.id}`} className="border-l-2 border-amber-300 pl-3">
                    <div className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
                      <Icon className="size-3.5 shrink-0" aria-hidden />
                      <span className="font-medium">{where}</span>
                      {h.author && <span>· {h.author}</span>}
                      {h.at && <span>· {date(h.at)}</span>}
                    </div>
                    <p className="mt-0.5 whitespace-pre-line break-words text-sm">
                      {h.snippet.cutStart && "… "}
                      <Highlighted text={h.snippet.text} marks={h.snippet.marks} />
                      {h.snippet.cutEnd && " …"}
                    </p>
                  </li>
                );
              })}
              {r.hitCount > r.hits.length && (
                <li className="pl-3 text-xs text-muted">
                  <a href={linkFor(r.id)} className="hover:underline">
                    {t("moreHits", { count: r.hitCount - r.hits.length })}
                  </a>
                </li>
              )}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}
