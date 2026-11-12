import { describe, it, expect, vi, afterEach } from "vitest";
import { limited, exhausted, clientIp } from "@/lib/ratelimit";

describe("rate limiter (NFT-07)", () => {
  afterEach(() => vi.useRealTimers());
  it("allows up to the maximum, then blocks", () => { const k = "t1:" + Math.random(); for (let i = 0; i < 3; i++) expect(limited(k, 3, 60_000)).toBe(false); expect(limited(k, 3, 60_000)).toBe(true); });
  it("keys are independent", () => { const a = "t2a:" + Math.random(), b = "t2b:" + Math.random(); for (let i = 0; i < 5; i++) limited(a, 2, 60_000); expect(limited(b, 2, 60_000)).toBe(false); });
  it("the window resets after it expires", () => { vi.useFakeTimers(); const k = "t3:" + Math.random(); limited(k, 1, 1000); expect(limited(k, 1, 1000)).toBe(true); vi.advanceTimersByTime(1500); expect(limited(k, 1, 1000)).toBe(false); });
  it("exhausted() peeks without counting", () => { const k = "t4:" + Math.random(); expect(exhausted(k, 2)).toBe(false); limited(k, 2, 60_000); limited(k, 2, 60_000); expect(exhausted(k, 2)).toBe(true); expect(exhausted(k, 2)).toBe(true); });
  it("reads the client address from proxy headers", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4"); expect(clientIp(new Headers({ "x-real-ip": "5.6.7.8" }))).toBe("5.6.7.8"); expect(clientIp(new Headers())).toBe("unknown");
  });
  it("purges expired keys when the table grows large", () => { vi.useFakeTimers(); for (let i = 0; i < 5100; i++) limited("bulk:" + i, 1, 10); vi.advanceTimersByTime(50); expect(limited("bulk:new", 1, 10)).toBe(false); });
});
