import { describe, it, expect } from "vitest";
import { translate, fromHeader, LANGS, isLang } from "@/lib/i18n";
import fr from "@/lib/i18n/fr"; import rw from "@/lib/i18n/rw"; import sw from "@/lib/i18n/sw";

const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");
describe("languages (EN, RW, SW, FR)", () => {
  it("offers exactly English, Kinyarwanda, Kiswahili and French", () => { expect(LANGS.map((l) => l.code)).toEqual(["en", "rw", "sw", "fr"]); expect(isLang("fr")).toBe(true); expect(isLang("de")).toBe(false); });
  it("falls back to English for text without a translation and fills placeholders", () => {
    expect(translate(fr, "Some text nobody translated")).toBe("Some text nobody translated"); expect(translate(undefined, "Hello {n}", { n: 3 })).toBe("Hello 3");
    expect(translate(sw, "Welcome, {name}", { name: "Aline" })).toBe("Karibu, Aline"); expect(translate(rw, "Sign out")).toBe("Sohoka"); expect(translate(fr, "Courses")).toBe("Formations");
  });
  it("picks a language from Accept-Language", () => { expect(fromHeader("fr-FR,fr;q=0.9")).toBe("fr"); expect(fromHeader("rw")).toBe("rw"); expect(fromHeader("sw-KE")).toBe("sw"); expect(fromHeader("de,es")).toBe("en"); expect(fromHeader(null)).toBe("en"); });
  for (const [name, d] of [["fr", fr], ["rw", rw], ["sw", sw]] as const) {
    it(`${name}: every translation is non-empty and keeps the same {placeholders} as the English`, () => { const bad = Object.entries(d).filter(([k, v]) => !v.trim() || ph(k) !== ph(v)); expect(bad).toEqual([]); });
  }
  it("each dictionary covers the interface text (entries identical to English are left out)", () => { for (const d of [fr, rw, sw]) expect(Object.keys(d).length).toBeGreaterThan(400); const all = new Set([...Object.keys(fr), ...Object.keys(rw), ...Object.keys(sw)]); expect(all.size).toBeGreaterThan(430); });
});
