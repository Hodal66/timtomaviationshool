import { describe, it, expect, vi, beforeAll } from "vitest";
vi.mock("@/lib/db", () => ({ db: {} })); vi.mock("@/lib/notify", () => ({ notifyApplicant: vi.fn() }));
import { qrCodeFor, qrCodeOk, QR_SLICE_MS, scanStatus, rateOf, attended, calToken, readCalToken, buildIcs, kigaliMinutes, kigaliDate, kigaliDow } from "@/lib/teaching";

describe("teaching rules (TTB-03, ATT-01, ATT-03)", () => {
  beforeAll(() => { process.env.AUTH_SECRET = "unit-secret"; });
  it("the QR code changes every 30 seconds; the current and previous code are valid, older and foreign ones are not", () => {
    const t = 1_800_000_000_000; const now = qrCodeFor("sess1", t); expect(now).toMatch(/^[0-9a-f]{10}$/); expect(qrCodeFor("sess1", t + 1000)).toBe(now); expect(qrCodeFor("sess1", t + QR_SLICE_MS)).not.toBe(now);
    expect(qrCodeOk("sess1", now, t)).toBe(true); expect(qrCodeOk("sess1", now, t + QR_SLICE_MS)).toBe(true); expect(qrCodeOk("sess1", now, t + 2 * QR_SLICE_MS)).toBe(false); expect(qrCodeOk("sess2", now, t)).toBe(false); expect(qrCodeOk("sess1", "", t)).toBe(false); expect(qrCodeOk("sess1", "zzzzzzzzzz", t)).toBe(false);
  });
  it("a scan more than 15 minutes after the start is late", () => { expect(scanStatus(480, 480)).toBe("PRESENT"); expect(scanStatus(480, 495)).toBe("PRESENT"); expect(scanStatus(480, 496)).toBe("LATE"); expect(scanStatus(480, 470)).toBe("PRESENT"); });
  it("attendance rate counts present, late and excused; null when nothing is recorded", () => { expect(rateOf([])).toBeNull(); expect(rateOf(["PRESENT", "LATE", "EXCUSED", "ABSENT"])).toBe(75); expect(rateOf(["ABSENT"])).toBe(0); expect(rateOf(["PRESENT", "PRESENT", "ABSENT"])).toBe(67); expect(attended("ABSENT")).toBe(false); });
  it("Kigali time is UTC+2, including across midnight", () => { const d = new Date("2026-11-13T22:30:00Z"); expect(kigaliMinutes(d)).toBe(30); expect(kigaliDate(d).toISOString().slice(0, 10)).toBe("2026-11-14"); expect(kigaliDow(d)).toBe(6); expect(kigaliDow(new Date("2026-11-16T05:00:00Z"))).toBe(1); });
  it("calendar links are signed: a changed id or signature is rejected", () => { const tk = calToken("g", "cabc123"); expect(readCalToken(tk)).toEqual({ kind: "g", id: "cabc123" }); expect(readCalToken(tk.replace("cabc123", "cabc124"))).toBeNull(); expect(readCalToken(tk.replace(/^g/, "l"))).toBeNull(); expect(readCalToken("g-cabc123-00000000000000000000")).toBeNull(); expect(readCalToken("junk")).toBeNull(); expect(readCalToken(calToken("l", "u1"))).toEqual({ kind: "l", id: "u1" }); });
  it("builds a valid weekly iCalendar feed in Kigali time, starting on the first matching weekday", () => {
    const ics = buildIcs("Timtom: G1", [{ id: "s1", subject: "Fares; Ticketing, basics", dayOfWeek: 3, startMin: 480, endMin: 600, room: "Room A", lecturer: "Kamali", group: "G1", from: new Date("2027-01-11T00:00:00Z"), months: 3 }], new Date("2026-11-13T10:00:00Z"));
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true); expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true); expect(ics).toContain("DTSTART;TZID=Africa/Kigali:20270113T080000"); expect(ics).toContain("DTEND;TZID=Africa/Kigali:20270113T100000"); expect(ics).toContain("RRULE:FREQ=WEEKLY;BYDAY=WE;UNTIL=20270411T215959Z"); expect(ics).toContain("SUMMARY:Fares\; Ticketing\\, basics"); expect(ics).toContain("UID:s1@tas-one"); expect(ics.split("BEGIN:VEVENT").length - 1).toBe(1);
    expect(buildIcs("Empty", [])).toContain("END:VCALENDAR"); const sun = buildIcs("x", [{ id: "s2", subject: "W", dayOfWeek: 7, startMin: 540, endMin: 840, room: "R", lecturer: "L", group: "G", from: new Date("2027-01-11T00:00:00Z"), months: 0 }]); expect(sun).toContain("DTSTART;TZID=Africa/Kigali:20270117T090000"); expect(sun).toContain("BYDAY=SU;UNTIL=20270211");
  });
});
