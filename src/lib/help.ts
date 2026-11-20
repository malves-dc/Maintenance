import type { Permission } from "@/lib/rbac";

// In-app help (/help): one article per area of the app. The articles live in src/content/help/<slug>.ts
// (both languages side by side); this file holds the registry and the small text format they're written in.

export type HelpGroup = "start" | "operations" | "sites" | "supply" | "insights" | "settings";

export type HelpTopic = {
  slug: string;
  group: HelpGroup;
  icon: string; // lucide icon name, resolved in components/help
  href?: string; // the area the article explains
  permission?: Permission; // same gate as the area's nav item: the article is hidden without it
  paths: string[]; // app paths whose "Help" button opens this article (prefix match)
};

export const HELP_GROUPS: HelpGroup[] = ["start", "operations", "sites", "supply", "insights", "settings"];

export const HELP_TOPICS: HelpTopic[] = [
  { slug: "getting-started", group: "start", icon: "Compass", paths: [] },
  { slug: "dashboard", group: "start", icon: "LayoutDashboard", href: "/dashboard", paths: ["/dashboard"] },
  { slug: "search", group: "start", icon: "Search", href: "/search", permission: "internal.view", paths: ["/search"] },
  { slug: "field-app", group: "start", icon: "Smartphone", href: "/m", permission: "workOrders.execute", paths: ["/m"] },
  { slug: "scan", group: "start", icon: "ScanLine", href: "/scan", permission: "internal.view", paths: ["/scan"] },
  { slug: "notifications", group: "start", icon: "Bell", href: "/notifications", paths: ["/notifications"] },

  { slug: "work-orders", group: "operations", icon: "ClipboardList", href: "/work-orders", permission: "internal.view", paths: ["/work-orders"] },
  { slug: "requests", group: "operations", icon: "Inbox", href: "/requests", permission: "internal.view", paths: ["/requests"] },
  { slug: "on-call", group: "operations", icon: "PhoneCall", href: "/on-call", permission: "internal.view", paths: ["/on-call", "/settings/users/on-call"] },
  { slug: "preventive", group: "operations", icon: "CalendarClock", href: "/preventive", permission: "internal.view", paths: ["/preventive"] },
  { slug: "procedures", group: "operations", icon: "ListChecks", href: "/procedures", permission: "internal.view", paths: ["/procedures"] },
  { slug: "messages", group: "operations", icon: "MessagesSquare", href: "/messages", permission: "internal.view", paths: ["/messages"] },

  { slug: "clients", group: "sites", icon: "Users", href: "/clients", permission: "internal.view", paths: ["/clients"] },
  { slug: "contracts", group: "sites", icon: "FileSignature", href: "/contracts", permission: "internal.view", paths: ["/contracts"] },
  { slug: "villas", group: "sites", icon: "House", href: "/villas", permission: "internal.view", paths: ["/villas"] },
  { slug: "assets", group: "sites", icon: "Cpu", href: "/assets", permission: "internal.view", paths: ["/assets"] },
  { slug: "meters", group: "sites", icon: "Gauge", href: "/meters", permission: "internal.view", paths: ["/meters"] },

  { slug: "parts", group: "supply", icon: "Package", href: "/parts", permission: "internal.view", paths: ["/parts"] },
  { slug: "purchase-orders", group: "supply", icon: "ShoppingCart", href: "/purchase-orders", permission: "purchasing.manage", paths: ["/purchase-orders"] },
  { slug: "vendors", group: "supply", icon: "Truck", href: "/vendors", permission: "internal.view", paths: ["/vendors"] },

  { slug: "reports", group: "insights", icon: "ChartColumn", href: "/reports", permission: "reports.view", paths: ["/reports"] },

  { slug: "profile", group: "settings", icon: "UserRound", href: "/settings/profile", paths: ["/settings/profile"] },
  { slug: "organization", group: "settings", icon: "Building2", href: "/settings/organization", permission: "org.manage", paths: ["/settings/organization"] },
  { slug: "users", group: "settings", icon: "UserCog", href: "/settings/users", permission: "users.manage", paths: ["/settings/users"] },
  { slug: "client-users", group: "settings", icon: "Contact", href: "/settings/client-users", permission: "users.manage", paths: ["/settings/client-users"] },
  { slug: "roles", group: "settings", icon: "BadgeCheck", href: "/settings/roles", permission: "users.manage", paths: ["/settings/roles"] },
  { slug: "teams", group: "settings", icon: "UsersRound", href: "/settings/teams", permission: "teams.manage", paths: ["/settings/teams"] },
  { slug: "offices", group: "settings", icon: "MapPinned", href: "/settings/offices", permission: "org.manage", paths: ["/settings/offices"] },
  { slug: "categories", group: "settings", icon: "Tags", href: "/settings/categories", permission: "workOrders.manage", paths: ["/settings/categories"] },
  { slug: "audit", group: "settings", icon: "ScrollText", href: "/settings/audit", permission: "audit.view", paths: ["/settings/audit"] },
  { slug: "server", group: "settings", icon: "Server", href: "/settings/server", permission: "org.manage", paths: ["/settings/server"] },
];

export const helpTopic = (slug: string) => HELP_TOPICS.find((t) => t.slug === slug);

/** The article for an app path (longest matching prefix), or undefined for the help index. */
export function helpTopicFor(pathname: string): HelpTopic | undefined {
  let best: { topic: HelpTopic; len: number } | undefined;
  for (const topic of HELP_TOPICS) {
    for (const p of topic.paths) {
      if ((pathname === p || pathname.startsWith(p + "/")) && (!best || p.length > best.len)) best = { topic, len: p.length };
    }
  }
  return best?.topic;
}

/** Link target of the contextual help button. */
export function helpHref(pathname: string): string {
  const topic = helpTopicFor(pathname);
  return topic ? `/help/${topic.slug}` : "/help";
}

// ---------------------------------------------------------------------------------------------------------
// Article format: a small subset of Markdown, parsed into blocks and rendered without raw HTML.
//
//   # Title                 first line; the first paragraph after it is the summary shown on the index
//   ## Section              starts a section (listed in the article's table of contents)
//   ### Sub-heading
//   plain lines             a paragraph (consecutive lines are joined)
//   - item                  bulleted list
//   1. item                 numbered list (steps)
//   > text                  a tip / note callout
//   ![caption](shot-name)   screenshot public/help/<locale>/<shot-name>.png
//   inline: **bold** (UI labels) and [text](/help/slug) or [text](/path) links (in-app only)

export type HelpInline = { type: "text" | "bold"; text: string } | { type: "link"; text: string; href: string };

export type HelpBlock =
  | { type: "p"; content: HelpInline[] }
  | { type: "h3"; text: string }
  | { type: "ul" | "ol"; items: HelpInline[][] }
  | { type: "tip"; content: HelpInline[] }
  | { type: "shot"; name: string; caption: string };

export type HelpSection = { id: string; title: string; blocks: HelpBlock[] };
export type HelpArticle = { title: string; summary: string; intro: HelpBlock[]; sections: HelpSection[] };

/** An article's text in each language. */
export type HelpText = { en: string; pt: string };

/** A screenshot the capture script takes (scripts/help-screenshots.ts), in both languages. */
export type HelpShot = {
  name: string; // file name, referenced as ![caption](name)
  path: string; // page to open, e.g. "/work-orders"
  open?: string; // optional: then follow the first link whose text contains this (demo data, same in both languages)
  selector?: string; // element to capture (default: the page content, without the menu)
  width?: number; // viewport width in CSS pixels (default 1280), e.g. 412 for a phone
  maxHeight?: number; // crop height in CSS pixels (default 760)
};

export const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export function parseInline(text: string): HelpInline[] {
  const out: HelpInline[] = [];
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\((\/[^)\s]*)\)/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push({ type: "text", text: text.slice(last, m.index) });
    out.push(m[1] !== undefined ? { type: "bold", text: m[1] } : { type: "link", text: m[2], href: m[3] });
    last = re.lastIndex;
  }
  if (last < text.length) out.push({ type: "text", text: text.slice(last) });
  return out;
}

export const plainText = (content: HelpInline[]) => content.map((c) => c.text).join("");

export function parseHelp(source: string): HelpArticle {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  let title = "";
  const intro: HelpBlock[] = [];
  const sections: HelpSection[] = [];
  let blocks = intro;
  let para: string[] = [];
  let list: { type: "ul" | "ol"; items: HelpInline[][] } | null = null;
  let tip: string[] = [];

  const flush = () => {
    if (para.length) blocks.push({ type: "p", content: parseInline(para.join(" ")) });
    if (list) blocks.push(list);
    if (tip.length) blocks.push({ type: "tip", content: parseInline(tip.join(" ")) });
    para = [];
    list = null;
    tip = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    let m: RegExpMatchArray | null;
    if (!line) {
      flush();
    } else if ((m = line.match(/^#\s+(.+)$/))) {
      flush();
      title = m[1];
    } else if ((m = line.match(/^##\s+(.+)$/))) {
      flush();
      const section: HelpSection = { id: slugify(m[1]), title: m[1], blocks: [] };
      sections.push(section);
      blocks = section.blocks;
    } else if ((m = line.match(/^###\s+(.+)$/))) {
      flush();
      blocks.push({ type: "h3", text: m[1] });
    } else if ((m = line.match(/^!\[([^\]]*)\]\(([a-z0-9-]+)\)$/))) {
      flush();
      blocks.push({ type: "shot", name: m[2], caption: m[1] });
    } else if ((m = line.match(/^>\s?(.*)$/))) {
      if (para.length || list) flush();
      tip.push(m[1]);
    } else if ((m = line.match(/^(-|\d+\.)\s+(.+)$/))) {
      const type = m[1] === "-" ? "ul" : "ol";
      if (para.length || tip.length || (list && list.type !== type)) flush();
      list ??= { type, items: [] };
      list.items.push(parseInline(m[2]));
    } else if (list && /^\s{2,}/.test(raw)) {
      // continuation of the previous list item
      list.items[list.items.length - 1].push(...parseInline(" " + line));
    } else {
      if (list || tip.length) flush();
      para.push(line);
    }
  }
  flush();

  const first = intro.find((b) => b.type === "p");
  return { title, summary: first ? plainText(first.content) : "", intro, sections };
}

/** Screenshot names an article uses, in order. */
export const shotsIn = (a: HelpArticle) =>
  [a.intro, ...a.sections.map((s) => s.blocks)].flat().flatMap((b) => (b.type === "shot" ? [b.name] : []));
