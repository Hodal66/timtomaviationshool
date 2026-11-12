import { describe, expect, it } from "vitest";
import { upcomingIntakes, INTAKE_MONTHS } from "@/lib/intakes";

describe("quarterly intake calendar (PRG-02)", () => {
  it("uses January, April, July and October", () => expect(INTAKE_MONTHS).toEqual([0, 3, 6, 9]));
  it("returns the next four starts after a date", () => {
    const s = upcomingIntakes(4, new Date("2026-11-12T10:00:00Z"));
    expect(s.map((x) => x.key)).toEqual(["2027-01", "2027-04", "2027-07", "2027-10"]);
    expect(s[0].label).toBe("January 2027"); expect(s[0].startsOn.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });
  it("never offers a start that has already begun, so registration is never closed", () => {
    expect(upcomingIntakes(1, new Date("2027-04-01T00:00:00Z"))[0].key).toBe("2027-07");
    expect(upcomingIntakes(1, new Date("2027-03-31T23:59:59Z"))[0].key).toBe("2027-04");
  });
  it("rolls over the year end", () => expect(upcomingIntakes(2, new Date("2027-10-02T00:00:00Z")).map((x) => x.key)).toEqual(["2028-01", "2028-04"]));
  it("always returns the requested number", () => expect(upcomingIntakes(9, new Date()).length).toBe(9));
});
