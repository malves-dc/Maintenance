"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** The Hours section's tabs, styled like the other sections' (see reports/report-nav.tsx). */
export function HoursTabs({ tabs }: { tabs: { href: string; label: string }[] }) {
  const path = usePathname();
  const current = (href: string) => (href === "/horas" ? path === "/horas" || path.startsWith("/horas/novo") : path.startsWith(href));
  return (
    <nav className="mb-6 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-border">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={current(t.href) ? "page" : undefined}
          className={cn(
            "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm",
            current(t.href) ? "border-brand font-medium text-brand" : "border-transparent text-muted hover:text-foreground",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
