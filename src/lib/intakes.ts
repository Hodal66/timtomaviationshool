import { db } from "./db";

/** SRS PRG-02: a new intake every three months (January, April, July, October), each running six months. */
export const INTAKE_MONTHS = [0, 3, 6, 9];
const NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export type IntakeSlot = { key: string; label: string; startsOn: Date };
const slot = (y: number, m: number): IntakeSlot => ({ key: `${y}-${String(m + 1).padStart(2, "0")}`, label: `${NAMES[m]} ${y}`, startsOn: new Date(Date.UTC(y, m, 1)) });

/** The next `n` intake starts after `from`. Registration is never closed: applicants always get a next intake. */
export function upcomingIntakes(n = 4, from = new Date()): IntakeSlot[] {
  const out: IntakeSlot[] = [];
  for (let y = from.getUTCFullYear(); out.length < n; y++)
    for (const m of INTAKE_MONTHS) { const s = slot(y, m); if (s.startsOn > from && out.length < n) out.push(s); }
  return out;
}

/** Returns the Intake row for a start key like "2027-04", creating it on first use. Null if the key is not a real upcoming intake. */
export async function ensureIntake(key: string | undefined, from = new Date()) {
  const s = upcomingIntakes(6, from).find((x) => x.key === key);
  if (!s) return null;
  return db.intake.upsert({ where: { label: s.label }, update: {}, create: { label: s.label, startsOn: s.startsOn, endsOn: new Date(Date.UTC(s.startsOn.getUTCFullYear(), s.startsOn.getUTCMonth() + 6, 0)) } });
}

export const SESSIONS = {
  WEEKDAY: { label: "Weekday", detail: "Monday to Friday, three 2-hour sessions" },
  WEEKEND: { label: "Weekend", detail: "Saturday and Sunday, 9:00 AM to 2:00 PM" },
} as const;
