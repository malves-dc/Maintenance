// The yearly series shared by requests and work orders: 2026-1, 2026-2… A request's work order keeps the request's
// year and number; a work order without a request takes the next number. Pure: used by pages, PDFs and the field app.

export type SeriesNumber = { year: number; number: number };

/** How a request or work order number is shown: "2026-12". */
export const docRef = (d: SeriesNumber) => `${d.year}-${d.number}`;

/** The year a new record belongs to, in the company's time zone. */
export function seriesYear(timeZone: string, at = new Date()) {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric" }).format(at));
}

/** Reads what someone typed: "2026-12", or a bare "12" (year = `fallbackYear`). A leading # is ignored. Null when it isn't a number. */
export function parseDocRef(text: string, fallbackYear: number): SeriesNumber | null {
  const m = /^#?\s*(?:(\d{4})\s*[-/]\s*)?(\d{1,9})$/.exec(text.trim());
  if (!m) return null;
  const number = Number(m[2]);
  if (number <= 0) return null;
  return { year: m[1] ? Number(m[1]) : fallbackYear, number };
}
