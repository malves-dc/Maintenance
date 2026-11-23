// Privacy notice (GDPR art. 12–14). Each company has a public page at /privacy/<slug>: its own text
// (Settings → Organization) or, until it writes one, the built-in template filled with its details.

export const PRIVACY_SECTIONS = ["controller", "data", "purposes", "recipients", "transfers", "retention", "security", "rights"] as const;

export const privacyPath = (org: { slug: string }) => `/privacy/${org.slug}`;

// Terms of use: a public page at /terms/<slug>, the built-in text filled with the company's details
// (e.g. for the "terms of service" link that Google and Microsoft ask for when registering an OAuth app).
export const TERMS_SECTIONS = ["service", "accounts", "use", "content", "privacy", "availability", "law"] as const;

export const termsPath = (org: { slug: string }) => `/terms/${org.slug}`;

/** Splits plain text into paragraphs (blank lines), keeping single line breaks inside them. */
export function paragraphs(text: string) {
  return text
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}
