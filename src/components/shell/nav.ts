import type { Permission } from "@/lib/rbac";

export type NavItem = {
  href: string;
  labelKey: string; // key under "nav"
  icon: string; // lucide icon name, resolved in sidebar.tsx
  permission?: Permission;
  ready: boolean; // false = module not built yet (hidden)
  badge?: number; // filled in by the layout (e.g. pending requests)
};

export type NavGroup = { labelKey?: string; items: NavItem[] };

export const NAV: NavGroup[] = [
  {
    items: [
      { href: "/dashboard", labelKey: "dashboard", icon: "LayoutDashboard", ready: true },
      { href: "/search", labelKey: "search", icon: "Search", permission: "internal.view", ready: true },
      { href: "/m", labelKey: "field", icon: "Smartphone", permission: "workOrders.execute", ready: true },
      { href: "/scan", labelKey: "scan", icon: "ScanLine", permission: "internal.view", ready: true },
    ],
  },
  {
    labelKey: "operations",
    items: [
      { href: "/work-orders", labelKey: "workOrders", icon: "ClipboardList", permission: "internal.view", ready: true },
      { href: "/requests", labelKey: "requests", icon: "Inbox", permission: "internal.view", ready: true },
      { href: "/on-call", labelKey: "onCall", icon: "PhoneCall", permission: "internal.view", ready: true },
      { href: "/preventive", labelKey: "preventive", icon: "CalendarClock", permission: "internal.view", ready: true },
      { href: "/procedures", labelKey: "procedures", icon: "ListChecks", permission: "internal.view", ready: true },
      { href: "/messages", labelKey: "messages", icon: "MessagesSquare", permission: "internal.view", ready: true },
    ],
  },
  {
    labelKey: "sites",
    items: [
      { href: "/clients", labelKey: "clients", icon: "Users", permission: "internal.view", ready: true },
      { href: "/contracts", labelKey: "contracts", icon: "FileSignature", permission: "internal.view", ready: true },
      { href: "/villas", labelKey: "villas", icon: "House", permission: "internal.view", ready: true },
      { href: "/assets", labelKey: "assets", icon: "Cpu", permission: "internal.view", ready: true },
      { href: "/meters", labelKey: "meters", icon: "Gauge", permission: "internal.view", ready: true },
    ],
  },
  {
    labelKey: "supply",
    items: [
      { href: "/parts", labelKey: "parts", icon: "Package", permission: "internal.view", ready: true },
      { href: "/purchase-orders", labelKey: "purchaseOrders", icon: "ShoppingCart", permission: "purchasing.manage", ready: true },
      { href: "/vendors", labelKey: "vendors", icon: "Truck", permission: "internal.view", ready: true },
    ],
  },
  {
    labelKey: "insights",
    items: [{ href: "/reports", labelKey: "reports", icon: "ChartColumn", permission: "reports.view", ready: true }],
  },
  {
    labelKey: "settings",
    items: [
      { href: "/settings/profile", labelKey: "profile", icon: "UserRound", ready: true },
      { href: "/settings/organization", labelKey: "organization", icon: "Building2", permission: "org.manage", ready: true },
      { href: "/settings/technical", labelKey: "technical", icon: "Wrench", permission: "org.manage", ready: true },
      { href: "/settings/users", labelKey: "users", icon: "UserCog", permission: "users.manage", ready: true },
      { href: "/settings/client-users", labelKey: "clientUsers", icon: "Contact", permission: "users.manage", ready: true },
      { href: "/settings/roles", labelKey: "roles", icon: "BadgeCheck", permission: "users.manage", ready: true },
      { href: "/settings/teams", labelKey: "teams", icon: "UsersRound", permission: "teams.manage", ready: true },
      { href: "/settings/categories", labelKey: "categories", icon: "Tags", permission: "workOrders.manage", ready: true },
      { href: "/settings/audit", labelKey: "audit", icon: "ScrollText", permission: "audit.view", ready: true },
      { href: "/settings/server", labelKey: "server", icon: "Server", permission: "org.manage", ready: true },
    ],
  },
];
