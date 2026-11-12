import type { Programme } from "@prisma/client";

/** Subject areas for the catalogue. A filter chip is shown only when an approved programme belongs to it. */
export const AREAS = [
  { id: "aviation-management", label: "Aviation Management" },
  { id: "airport-airline", label: "Airline and Airport Management" },
  { id: "airport-ops", label: "Airport Operations" },
  { id: "dispatch", label: "Flight Dispatch" },
  { id: "safety-security", label: "Aviation Safety and Security" },
  { id: "cargo", label: "Air Cargo Management" },
  { id: "cabin-crew", label: "Air Cabin Crew" },
  { id: "ticketing", label: "Air Fares and Ticketing" },
  { id: "tourism", label: "Travel and Tourism Management" },
  { id: "professional", label: "IATA and other approved professional programmes" },
  { id: "ict", label: "Approved ICT and technology programmes" },
  { id: "other", label: "Other programmes" },
] as const;
export type AreaId = (typeof AREAS)[number]["id"];

export function areaOf(p: Pick<Programme, "type" | "visualTheme">): AreaId {
  if (p.type === "IATA" || p.type === "ICAO") return "professional";
  return (AREAS.some((a) => a.id === p.visualTheme) ? p.visualTheme : "other") as AreaId;
}
export const areaLabel = (id: string) => AREAS.find((a) => a.id === id)?.label ?? "Programme";
