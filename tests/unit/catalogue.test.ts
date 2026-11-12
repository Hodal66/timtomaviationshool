import { describe, expect, it } from "vitest";
import { asFaqs, asModules, readinessProblems, slugify, themeOf, categoryLabel } from "@/lib/catalogue";
import { areaOf, areaLabel } from "@/lib/areas";
import { photoFor } from "@/lib/images";

const base = { name: "X", slug: "x", type: "CERTIFICATE" as const, qualificationType: "Local certificate", awardingBody: null, summary: "s", description: "d" };

describe("catalogue rules (PRG-01, PRG-04)", () => {
  it("builds clean slugs", () => {
    expect(slugify("UI/UX Design Course")).toBe("uiux-design-course");
    expect(slugify("  Air   Fares & Ticketing with Amadeus ")).toBe("air-fares-ticketing-with-amadeus");
    expect(slugify("Café Ñandú")).toBe("cafe-nandu");
  });
  it("passes a complete programme", () => expect(readinessProblems(base)).toEqual([]));
  it("blocks missing essentials", () => {
    const p = readinessProblems({ ...base, slug: null, summary: "", description: " ", qualificationType: null });
    expect(p.length).toBe(4);
  });
  it("never lets a School certificate be labelled IATA or ICAO", () => {
    expect(readinessProblems({ ...base, awardingBody: "IATA" }).join(" ")).toMatch(/must not be labelled/);
    expect(readinessProblems({ ...base, type: "IATA", awardingBody: "IATA" })).toEqual([]);
    expect(readinessProblems({ ...base, awardingBody: "Timtom Aviation School" })).toEqual([]);
  });
  it("tolerates malformed JSON content", () => {
    expect(asModules(null)).toEqual([]); expect(asModules([{ name: "A" }, { x: 1 }, null])).toEqual([{ name: "A" }]);
    expect(asFaqs([{ q: "q", a: "a" }, { q: "only" }])).toEqual([{ q: "q", a: "a" }]); expect(asFaqs("nope")).toEqual([]);
  });
  it("falls back to the default theme", () => { expect(themeOf("unknown")).toBe(themeOf("default")); expect(categoryLabel("ICT")).toBe("ICT programmes"); });
  it("maps programmes to subject areas, keeping IATA/ICAO professional", () => {
    expect(areaOf({ type: "IATA", visualTheme: "cargo" })).toBe("professional"); expect(areaOf({ type: "CERTIFICATE", visualTheme: "cargo" })).toBe("cargo");
    expect(areaOf({ type: "CERTIFICATE", visualTheme: "weird" })).toBe("other"); expect(areaLabel("cabin-crew")).toBe("Air Cabin Crew");
  });
  it("chooses images by priority: own image, area photo, then artwork", () => {
    expect(photoFor({ heroImage: "/api/assets/1", visualTheme: "ict", code: "TT1", name: "N" })?.src).toBe("/api/assets/1");
    expect(photoFor({ heroImage: null, visualTheme: "ict", code: "TT1", name: "N" })?.src).toMatch(/^\/images\/site\/hero-/);
    expect(photoFor({ heroImage: null, visualTheme: "ict", code: "TT1", name: "N" })).toEqual(photoFor({ heroImage: null, visualTheme: "ict", code: "TT1", name: "N" }));
    expect(photoFor({ heroImage: null, visualTheme: "cargo", code: "TT9", name: "N" })).toBeNull();
  });
});
