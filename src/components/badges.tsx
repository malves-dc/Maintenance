import { useTranslations } from "next-intl";
import { Cable, Camera, CircleCheck, CirclePause, Clock, Cpu, Lightbulb, Network, ShieldCheck, Speaker, TriangleAlert, Wrench, Zap, ChevronsUp, ChevronUp, Equal, ChevronDown, type LucideIcon } from "lucide-react";
import type { AssetStatus, Criticality, Priority, PurchaseOrderStatus, SystemType, WorkOrderStatus } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

export const SYSTEM_STYLE: Record<SystemType, { icon: LucideIcon; className: string }> = {
  ELECTRICAL: { icon: Zap, className: "bg-amber-50 text-amber-800" },
  AUTOMATION: { icon: Cpu, className: "bg-violet-50 text-violet-800" },
  NETWORK: { icon: Network, className: "bg-sky-50 text-sky-800" },
  SECURITY: { icon: ShieldCheck, className: "bg-rose-50 text-rose-800" },
  CCTV: { icon: Camera, className: "bg-slate-100 text-slate-800" },
  AV: { icon: Speaker, className: "bg-fuchsia-50 text-fuchsia-800" },
  LIGHTING: { icon: Lightbulb, className: "bg-yellow-50 text-yellow-800" },
  OTHER: { icon: Wrench, className: "bg-gray-100 text-gray-700" },
};

export function SystemBadge({ system, className }: { system: SystemType; className?: string }) {
  const t = useTranslations("systems");
  const { icon: Icon, className: tone } = SYSTEM_STYLE[system] ?? { icon: Cable, className: "" };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", tone, className)}>
      <Icon className="size-3" />
      {t(system)}
    </span>
  );
}

const STATUS_TONE: Record<AssetStatus, string> = {
  OPERATIONAL: "bg-green-50 text-green-700",
  DEGRADED: "bg-amber-50 text-amber-800",
  DOWN: "bg-red-50 text-red-700",
  DECOMMISSIONED: "bg-gray-100 text-gray-600",
};

export function AssetStatusBadge({ status }: { status: AssetStatus }) {
  const t = useTranslations("assetStatus");
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium", STATUS_TONE[status])}>
      <span className="size-1.5 rounded-full bg-current" />
      {t(status)}
    </span>
  );
}

const CRIT_TONE: Record<Criticality, string> = {
  LOW: "text-gray-500",
  MEDIUM: "text-gray-700",
  HIGH: "text-amber-700",
  CRITICAL: "text-red-700 font-medium",
};

export function CriticalityText({ value }: { value: Criticality }) {
  const t = useTranslations("criticality");
  return <span className={cn("text-xs", CRIT_TONE[value])}>{t(value)}</span>;
}

export const WO_STATUS_TONE: Record<WorkOrderStatus, string> = {
  OPEN: "bg-sky-50 text-sky-800",
  EN_ROUTE: "bg-violet-50 text-violet-800",
  IN_PROGRESS: "bg-indigo-50 text-indigo-800",
  ON_HOLD: "bg-amber-50 text-amber-800",
  DONE: "bg-green-50 text-green-700",
  CANCELLED: "bg-gray-100 text-gray-600",
};

export function WorkOrderStatusBadge({ status, className }: { status: WorkOrderStatus; className?: string }) {
  const t = useTranslations("woStatus");
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium", WO_STATUS_TONE[status], className)}>
      <span className="size-1.5 rounded-full bg-current" />
      {t(status)}
    </span>
  );
}

export const PO_STATUS_TONE: Record<PurchaseOrderStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  PENDING_APPROVAL: "bg-amber-50 text-amber-800",
  APPROVED: "bg-sky-50 text-sky-800",
  ORDERED: "bg-indigo-50 text-indigo-800",
  PARTIALLY_RECEIVED: "bg-violet-50 text-violet-800",
  RECEIVED: "bg-green-50 text-green-700",
  CANCELLED: "bg-gray-100 text-gray-500 line-through",
};

export function PoStatusBadge({ status, className }: { status: PurchaseOrderStatus; className?: string }) {
  const t = useTranslations("poStatus");
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium", PO_STATUS_TONE[status], className)}>
      <span className="size-1.5 rounded-full bg-current" />
      {t(status)}
    </span>
  );
}

const SLA_STYLE = {
  met: { icon: CircleCheck, className: "bg-green-50 text-green-700" },
  breached: { icon: TriangleAlert, className: "bg-red-50 text-red-700" },
  pending: { icon: Clock, className: "bg-amber-50 text-amber-800" },
  paused: { icon: CirclePause, className: "bg-gray-100 text-gray-700" },
} as const;

/** SLA outcome with icon + word (never colour alone); nothing for "not applicable". */
export function SlaBadge({ state, prefix }: { state: "met" | "breached" | "pending" | "paused" | "na"; prefix?: string }) {
  const t = useTranslations("sla");
  if (state === "na") return null;
  const { icon: Icon, className } = SLA_STYLE[state];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", className)}>
      <Icon className="size-3" />
      {prefix ? `${prefix}: ` : ""}
      {t(state)}
    </span>
  );
}

export function LowStockBadge() {
  const t = useTranslations("parts");
  return <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">{t("low")}</span>;
}

const PRIORITY_STYLE: Record<Priority, { icon: LucideIcon | null; className: string }> = {
  NONE: { icon: null, className: "text-gray-400" },
  LOW: { icon: ChevronDown, className: "text-gray-500" },
  MEDIUM: { icon: Equal, className: "text-amber-600" },
  HIGH: { icon: ChevronUp, className: "text-orange-600" },
  URGENT: { icon: ChevronsUp, className: "text-red-600 font-semibold" },
};

export function PriorityText({ priority }: { priority: Priority }) {
  const t = useTranslations("priority");
  if (priority === "NONE") return null;
  const { icon: Icon, className } = PRIORITY_STYLE[priority];
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs", className)}>
      {Icon && <Icon className="size-3.5" />}
      {t(priority)}
    </span>
  );
}
/** Work-order category label with its colour dot (the name carries the meaning, not the colour). */
export function CategoryChip({ name, color }: { name: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-muted">
      <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
      {name}
    </span>
  );
}
