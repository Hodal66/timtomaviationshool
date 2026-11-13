import { vi } from "vitest";
// Next.js runtime pieces that are not available outside the server.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "user-agent": "vitest", "accept-language": "en" }), cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }) }));
export { db } from "@/lib/db";
let n = 0; export const uniquePhone = () => `+25078${String(Date.now()).slice(-5)}${String(n++ % 1000).padStart(3, "0")}`;
