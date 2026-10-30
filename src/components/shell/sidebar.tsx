"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { NotificationBell } from "@/components/notifications/bell";
import {
  BadgeCheck,
  Building2,
  CalendarClock,
  ChartColumn,
  ChevronsUpDown,
  ClipboardList,
  Cpu,
  FileSignature,
  Gauge,
  House,
  Inbox,
  Contact,
  PhoneCall,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  MessagesSquare,
  Package,
  ScanLine,
  ScrollText,
  Search,
  Server,
  ShoppingCart,
  Smartphone,
  Truck,
  UserCog,
  UserRound,
  Users,
  UsersRound,
  Tags,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { signOutAction, switchOrgAction } from "@/app/(auth)/actions";
import { cn } from "@/lib/utils";
import type { NavGroup } from "./nav";

const ICONS: Record<string, LucideIcon> = {
  BadgeCheck,
  Building2,
  CalendarClock,
  ChartColumn,
  ClipboardList,
  Cpu,
  FileSignature,
  Gauge,
  House,
  Inbox,
  Contact,
  PhoneCall,
  LayoutDashboard,
  ListChecks,
  MessagesSquare,
  Package,
  ScanLine,
  Search,
  ShoppingCart,
  Smartphone,
  Truck,
  UserCog,
  UserRound,
  Users,
  UsersRound,
  Tags,
  ScrollText,
  Server,
  Wrench,
};

type Props = {
  appName: string;
  version?: string | null; // release version or dev commit, when Settings → Server asks for it
  groups: NavGroup[]; // already filtered by permission/readiness on the server
  user: { name: string; email: string; role: string }; // role: display name (custom role or translated built-in)
  org: { id: string; name: string; logo: string | null };
  orgs: { id: string; name: string }[];
  unreadNotifications: number;
};

export function Sidebar({ appName, version, groups, user, org, orgs, unreadNotifications }: Props) {
  const t = useTranslations();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [orgMenu, setOrgMenu] = useState(false);
  const [pending, start] = useTransition();

  const content = (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-3">
        <button
          type="button"
          onClick={() => orgs.length > 1 && setOrgMenu((v) => !v)}
          className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left hover:bg-gray-100"
        >
          <span className="flex min-w-0 items-center gap-2.5">
            {org.logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={org.logo} alt="" className="size-9 shrink-0 rounded-md border border-border bg-white object-contain p-0.5" />
            )}
            <span className="min-w-0">
              <span className="block text-xs font-semibold uppercase tracking-wide text-brand">
                {appName}
                {version && <span className="ml-1.5 font-mono font-normal normal-case tracking-normal text-muted">{version}</span>}
              </span>
              <span className="block truncate text-sm font-medium">{org.name}</span>
            </span>
          </span>
          {orgs.length > 1 && <ChevronsUpDown className="size-4 text-muted" />}
        </button>
        {orgMenu && (
          <div className="mt-1 space-y-0.5">
            {orgs
              .filter((o) => o.id !== org.id)
              .map((o) => (
                <button
                  key={o.id}
                  type="button"
                  disabled={pending}
                  onClick={() => start(() => switchOrgAction(o.id))}
                  className="block w-full truncate rounded-md px-2 py-1.5 text-left text-sm text-muted hover:bg-gray-100 hover:text-foreground"
                >
                  {o.name}
                </button>
              ))}
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto p-3">
        {groups.map((g, i) => (
          <div key={g.labelKey ?? i}>
            {g.labelKey && (
              <div className="mb-1 px-2 text-xs font-medium uppercase tracking-wide text-muted">{t(`nav.${g.labelKey}`)}</div>
            )}
            <ul className="space-y-0.5">
              {g.items.map((item) => {
                const Icon = ICONS[item.icon];
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm",
                        active ? "bg-brand/10 font-medium text-brand" : "text-gray-700 hover:bg-gray-100",
                      )}
                    >
                      {Icon && <Icon className="size-4 shrink-0" />}
                      <span className="flex-1">{t(`nav.${item.labelKey}`)}</span>
                      {item.badge ? (
                        <span className="rounded-full bg-amber-500 px-1.5 text-xs font-semibold text-white tabular-nums">{item.badge}</span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-border p-3">
        <div className="flex items-center justify-between gap-2 px-1">
          <Link href="/settings/profile" onClick={() => setOpen(false)} className="min-w-0 flex-1 rounded-md hover:text-brand">
            <div className="truncate text-sm font-medium">{user.name}</div>
            <div className="truncate text-xs text-muted">{user.role}</div>
          </Link>
          <NotificationBell key={unreadNotifications} initial={unreadNotifications} href="/notifications" />
          <form action={signOutAction}>
            <button title={t("common.signOut")} className="rounded-md p-2 text-muted hover:bg-gray-100 hover:text-foreground">
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-surface px-4 lg:hidden print:hidden">
        <button type="button" onClick={() => setOpen(true)} aria-label="Menu" className="-ml-2 rounded-md p-2 hover:bg-gray-100">
          <Menu className="size-5" />
        </button>
        {org.logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={org.logo} alt="" className="size-7 rounded bg-white object-contain" />
        )}
        <span className="flex-1 truncate font-medium">{org.name}</span>
        <Link href="/search" aria-label={t("nav.search")} className="rounded-md p-2 text-muted hover:bg-gray-100">
          <Search className="size-4" />
        </Link>
        <Link href="/scan" aria-label={t("nav.scan")} className="rounded-md p-2 text-muted hover:bg-gray-100">
          <ScanLine className="size-4" />
        </Link>
        <NotificationBell key={unreadNotifications} initial={unreadNotifications} href="/notifications" />
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-surface shadow-xl">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute right-2 top-3 rounded-md p-2 hover:bg-gray-100"
            >
              <X className="size-4" />
            </button>
            {content}
          </aside>
        </div>
      )}

      {/* Desktop */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-border bg-surface lg:block print:hidden">{content}</aside>
    </>
  );
}
