import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHash } from "node:crypto";
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
import { signUpload, cloudinaryReady, deleteMedia, listMedia, FOLDER } from "@/lib/cloudinary";

const ENV = { CLOUDINARY_CLOUD_NAME: "democloud", CLOUDINARY_API_KEY: "key123", CLOUDINARY_API_SECRET: "secret456" };
describe("Cloudinary media library", () => {
  beforeEach(() => { Object.assign(process.env, ENV); });
  afterEach(() => { vi.restoreAllMocks(); Object.assign(process.env, ENV); });
  it("is not ready without credentials, and does nothing", async () => {
    for (const k of Object.keys(ENV)) delete process.env[k];
    expect(cloudinaryReady()).toBe(false); expect(signUpload()).toBeNull(); expect(await listMedia()).toEqual([]); expect(await deleteMedia("image:" + FOLDER + "/a")).toBe(false);
  });
  it("signs uploads with SHA-1 over the sorted parameters plus the secret, and never returns the secret", () => {
    const s = signUpload()!; expect(cloudinaryReady()).toBe(true);
    expect(s.signature).toBe(createHash("sha1").update(`asset_folder=${FOLDER}&folder=${FOLDER}&timestamp=${s.timestamp}secret456`).digest("hex"));
    expect(JSON.stringify(s)).not.toContain("secret456"); expect([s.cloud, s.apiKey, s.folder]).toEqual(["democloud", "key123", FOLDER]);
  });
  it("lists images, videos, audio and files, classifies them, builds thumbnails and sorts newest first", async () => {
    const mk = (id: string, format: string, at: string) => ({ public_id: `${FOLDER}/${id}`, format, secure_url: `https://res.cloudinary.com/democloud/x/upload/v1/${FOLDER}/${id}.${format}`, bytes: 1000, created_at: at, width: 10, height: 10 });
    const f = vi.spyOn(globalThis, "fetch").mockImplementation(async (u) => { const url = String(u);
      const body = url.includes("/image/upload") ? { resources: [mk("photo", "jpg", "2026-01-01"), mk("brochure", "pdf", "2026-01-05")] } : url.includes("/video/upload") ? { resources: [mk("clip", "mp4", "2026-01-03"), mk("song", "mp3", "2026-01-02")] } : { resources: [mk("sheet", "xlsx", "2026-01-04")] };
      return new Response(JSON.stringify(body), { status: 200 }); });
    const items = await listMedia(); expect(f).toHaveBeenCalledTimes(3);
    expect(items.map((i) => [i.name, i.kind])).toEqual([["brochure", "file"], ["sheet", "file"], ["clip", "video"], ["song", "audio"], ["photo", "image"]]);
    expect(items.find((i) => i.kind === "image")!.thumb).toContain("/upload/c_fill,w_520"); expect(items.find((i) => i.kind === "video")!.thumb).toMatch(/so_0.*\.jpg$/); expect(items.find((i) => i.kind === "audio")!.thumb).toBeNull();
  });
  it("follows pagination and survives an API failure", async () => {
    let n = 0; vi.spyOn(globalThis, "fetch").mockImplementation(async (u) => { if (String(u).includes("/image/")) { n++; return new Response(JSON.stringify({ resources: [], ...(n < 3 ? { next_cursor: "c" + n } : {}) }), { status: 200 }); } return new Response("nope", { status: 500 }); });
    expect(await listMedia()).toEqual([]); expect(n).toBe(3);
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network")); expect(await listMedia()).toEqual([]);
  });
  it("deletes only files inside the gallery folder, and only known resource types", async () => {
    const f = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    expect(await deleteMedia(`image:${FOLDER}/abc`)).toBe(true); expect(f).toHaveBeenCalledTimes(1);
    expect(await deleteMedia("image:other-folder/abc")).toBe(false); expect(await deleteMedia(`image:${FOLDER}/../secret`.replace("..", "x"))).toBe(true);
    expect(await deleteMedia(`script:${FOLDER}/abc`)).toBe(false); expect(f).toHaveBeenCalledTimes(2);
  });
});
