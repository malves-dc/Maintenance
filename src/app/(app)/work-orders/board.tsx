"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { CalendarClock } from "lucide-react";
import { PriorityText, WO_STATUS_TONE } from "@/components/badges";
import { cn } from "@/lib/utils";
import type { Priority, WorkOrderStatus } from "@/generated/prisma/enums";
import { setStatusAction } from "./actions";

type Card = {
  id: string;
  number: string;
  title: string;
  status: WorkOrderStatus;
  priority: Priority;
  villa: string | null;
  due: string | null;
  overdue: boolean;
  assignees: string[];
};

const COLUMNS: WorkOrderStatus[] = ["OPEN", "RECEIVED", "IN_PROGRESS", "ON_HOLD", "DONE"];

/** Kanban by status. Drag a card to another column to change its status. */
export function BoardView({ workOrders, canExecute }: { workOrders: Card[]; canExecute: boolean }) {
  const t = useTranslations();
  const [cards, moveCard] = useOptimistic(workOrders, (state, { id, status }: { id: string; status: WorkOrderStatus }) =>
    state.map((c) => (c.id === id ? { ...c, status } : c)),
  );
  const [over, setOver] = useState<WorkOrderStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  function drop(id: string, status: WorkOrderStatus) {
    setOver(null);
    const card = cards.find((c) => c.id === id);
    if (!card || card.status === status) return;
    setError(null);
    start(async () => {
      moveCard({ id, status });
      const res = await setStatusAction(id, status);
      if (res.error) setError(`${card.number}: ${t(res.error as never)}`);
    });
  }

  return (
    <>
      {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-danger">{error}</p>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {COLUMNS.map((status) => {
          const list = cards.filter((c) => c.status === status);
          return (
            <div
              key={status}
              onDragOver={(e) => {
                if (!canExecute) return;
                e.preventDefault();
                setOver(status);
              }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => drop(e.dataTransfer.getData("text/plain"), status)}
              className={cn("rounded-lg bg-gray-100/70 p-2 transition", over === status && "ring-2 ring-brand/40")}
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", WO_STATUS_TONE[status])}>{t(`woStatus.${status}`)}</span>
                <span className="text-xs text-muted">{list.length}</span>
              </div>
              <div className="min-h-24 space-y-2">
                {list.map((c) => (
                  <Link
                    key={c.id}
                    href={`/work-orders/${c.id}`}
                    draggable={canExecute}
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", c.id)}
                    className="block rounded-md border border-border bg-surface p-3 text-sm shadow-sm hover:border-brand/40"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium leading-snug">{c.title}</span>
                      <span className="font-mono text-xs text-muted">{c.number}</span>
                    </div>
                    {c.villa && <div className="mt-1 text-xs text-muted">{c.villa}</div>}
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <PriorityText priority={c.priority} />
                      {c.due && (
                        <span className={cn("inline-flex items-center gap-1 text-xs", c.overdue ? "font-medium text-danger" : "text-muted")}>
                          <CalendarClock className="size-3.5" />
                          {c.due}
                        </span>
                      )}
                    </div>
                    {c.assignees.length > 0 && <div className="mt-1.5 truncate text-xs text-muted">{c.assignees.join(", ")}</div>}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
