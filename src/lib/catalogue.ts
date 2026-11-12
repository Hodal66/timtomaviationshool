import type { ProgrammeType, Session } from "@prisma/client";

export const CATEGORIES: { type: ProgrammeType; label: string; blurb: string }[] = [
  { type: "IATA", label: "IATA programmes", blurb: "Training aligned to IATA syllabi, where the School's IATA arrangement is confirmed." },
  { type: "ICAO", label: "ICAO programmes", blurb: "ICAO-related training, where officially offered." },
  { type: "ADVANCED_CERTIFICATE", label: "Advanced certificates", blurb: "Longer School-issued programmes with advanced content." },
  { type: "CERTIFICATE", label: "Certificates", blurb: "School-issued certificate programmes." },
  { type: "ICT", label: "ICT programmes", blurb: "Technology training approved by the School." },
];
export const categoryLabel = (t: ProgrammeType) => CATEGORIES.find((c) => c.type === t)?.label ?? t;

export const SESSION_TEXT: Record<Session, string> = {
  WEEKDAY: "Weekday: Monday to Friday, three 2-hour sessions",
  WEEKEND: "Weekend: Saturday and Sunday, 9:00 AM to 2:00 PM",
};
export const MODE_TEXT: Record<string, string> = { ON_CAMPUS: "On campus", ONLINE: "Online" };

export const THEME_KEYS = ["default", "aviation-management", "cabin-crew", "safety-security", "airport-airline", "cargo", "tourism", "airport-ops", "dispatch", "ticketing", "ict"] as const;
export type ThemeKey = (typeof THEME_KEYS)[number];

export const THEMES: Record<ThemeKey, { name: string; dark: string; accent: string; soft: string; line: string }> = {
  default: { name: "General", dark: "#0A2240", accent: "#F7893B", soft: "#E4EEFB", line: "#0B4DA2" },
  "aviation-management": { name: "Aviation management", dark: "#0E2A47", accent: "#E0A93B", soft: "#EAF0F7", line: "#2D5F8F" },
  "cabin-crew": { name: "Cabin crew", dark: "#4A1530", accent: "#F2A08A", soft: "#FBEDEA", line: "#9C3B63" },
  "safety-security": { name: "Safety and security", dark: "#17313A", accent: "#F0B429", soft: "#E8F1F2", line: "#2F7A87" },
  "airport-airline": { name: "Airline and airport management", dark: "#1A2A5A", accent: "#4CC3D9", soft: "#E9EDFA", line: "#3B55B5" },
  cargo: { name: "Air cargo", dark: "#2B2A24", accent: "#F28C28", soft: "#F3EFE6", line: "#8A6D2E" },
  tourism: { name: "Travel and tourism", dark: "#0B3B3A", accent: "#F4B942", soft: "#E3F4EF", line: "#1E8A7A" },
  "airport-ops": { name: "Airport operations", dark: "#1D2733", accent: "#F7C531", soft: "#EBEEF2", line: "#4B6179" },
  dispatch: { name: "Flight dispatch", dark: "#0A1B33", accent: "#5CE1E6", soft: "#E6EEF9", line: "#2C5AA0" },
  ticketing: { name: "Air fares and ticketing", dark: "#2A1F5C", accent: "#FF8A5B", soft: "#EEEAFB", line: "#5B47C2" },
  ict: { name: "ICT", dark: "#0F2A2E", accent: "#7BE0A6", soft: "#E4F3EF", line: "#1F8A6B" },
};
export const themeOf = (k: string) => THEMES[(k in THEMES ? k : "default") as ThemeKey];

export type Module = { name: string; description?: string };
export type Faq = { q: string; a: string };
export const asModules = (v: unknown): Module[] => (Array.isArray(v) ? (v as Module[]).filter((m) => m && m.name) : []);
export const asFaqs = (v: unknown): Faq[] => (Array.isArray(v) ? (v as Faq[]).filter((f) => f && f.q && f.a) : []);

export function slugify(s: string) {
  return s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 80);
}

/**
 * Essentials a course must have before it can be submitted or published.
 * Outcomes, modules, entry requirements, duration and delivery are optional: the public page hides any section with no approved content.
 * A School-issued certificate must never be labelled as IATA or ICAO.
 */
export function readinessProblems(p: {
  name: string; slug: string | null; type: ProgrammeType; qualificationType: string | null; awardingBody: string | null;
  summary: string | null; description: string | null; objectives?: string[]; entryRequirements?: string[]; durationMonths?: number | null; deliveryModes?: string[];
}) {
  const out: string[] = [];
  if (!p.slug) out.push("Add a web address (slug).");
  if (!p.summary?.trim()) out.push("Add a short summary.");
  if (!p.description?.trim()) out.push("Add the approved course description.");
  if (!p.qualificationType?.trim()) out.push("State the qualification type.");
  const body = (p.awardingBody ?? "").toUpperCase();
  const external = /\b(IATA|ICAO)\b/.test(body);
  if (p.awardingBody && (p.type === "IATA" || p.type === "ICAO") && !body.trim()) out.push("IATA and ICAO programmes must name the certifying body.");
  if (external && p.type !== "IATA" && p.type !== "ICAO") out.push("The certifying body mentions IATA or ICAO but the category is not IATA or ICAO. School-issued certificates must not be labelled as IATA or ICAO qualifications.");
  return out;
}

export const REQUIRED_DOCS = ["National ID or passport", "Passport-size photo", "A2 certificate or transcripts"];
