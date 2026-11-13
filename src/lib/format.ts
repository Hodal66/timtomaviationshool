export const money = (minor: number, cur: string) =>
  `${cur} ${(cur === "USD" ? minor / 100 : minor).toLocaleString("en-US")}`;
export const label = (s: string) => s.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
export const STAGES = ["SUBMITTED", "DOCUMENTS_VERIFIED", "REGISTRATION_PAID", "ADMITTED", "ENROLLED"] as const;
export const DAYS = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
export const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
/** Weekday classes run Mon-Fri; returns the next date (UTC midnight) on or after `d` that falls on `dow` (1=Mon). */
export function dateForDow(dow: number, from = new Date()) {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + (dow - 1)); // this week's day
  return d;
}
