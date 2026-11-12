import { createHash } from "node:crypto";
import { unstable_cache } from "next/cache";

/** All gallery files live in one Cloudinary folder. Credentials come from environment variables only. */
export const FOLDER = "tas-gallery";
export type Kind = "image" | "video" | "audio" | "file";
export type Media = { id: string; url: string; thumb: string | null; kind: Kind; format: string; bytes: number; name: string; at: string; width?: number; height?: number };

const cfg = () => { const c = process.env.CLOUDINARY_CLOUD_NAME, k = process.env.CLOUDINARY_API_KEY, s = process.env.CLOUDINARY_API_SECRET; return c && k && s ? { c, k, s } : null; };
export const cloudinaryReady = () => !!cfg();
const AUDIO = new Set(["mp3", "wav", "m4a", "aac", "ogg", "oga", "flac", "wma", "aiff"]);
const kindOf = (type: string, format: string): Kind => type === "raw" || format === "pdf" ? "file" : type === "video" ? (AUDIO.has(format) ? "audio" : "video") : "image";
const thumbOf = (url: string, kind: Kind) => {
  if (kind === "image") return url.replace("/upload/", "/upload/c_fill,w_520,h_360,g_auto,q_auto,f_auto/");
  if (kind === "video") return url.replace("/upload/", "/upload/c_fill,w_520,h_360,so_0,q_auto/").replace(/\.[a-z0-9]+$/i, ".jpg");
  return null;
};

type Raw = { public_id: string; resource_type: string; format?: string; secure_url: string; bytes: number; created_at: string; width?: number; height?: number; display_name?: string; filename?: string };

async function fetchMedia(): Promise<Media[]> {
  const k = cfg(); if (!k) return [];
  const auth = "Basic " + Buffer.from(`${k.k}:${k.s}`).toString("base64"); const out: Media[] = [];
  // The Admin API is read-after-write consistent (the Search index lags a few seconds), so new uploads show at once.
  for (const type of ["image", "video", "raw"]) {
    let cursor: string | undefined;
    for (let page = 0; page < 5; page++) {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${k.c}/resources/${type}/upload?prefix=${FOLDER}/&max_results=100${cursor ? "&next_cursor=" + cursor : ""}`, { cache: "no-store", headers: { authorization: auth }, signal: AbortSignal.timeout(8000) }).catch(() => null);
      if (!res?.ok) break;
      const j = (await res.json()) as { resources: Raw[]; next_cursor?: string };
      for (const r of j.resources) { const format = (r.format ?? r.public_id.split(".").pop() ?? "").toLowerCase(); const kind = kindOf(type, format);
        out.push({ id: `${type}:${r.public_id}`, url: r.secure_url, thumb: thumbOf(r.secure_url, kind), kind, format, bytes: r.bytes, name: (r.display_name ?? r.filename ?? r.public_id.split("/").pop() ?? "File").slice(0, 120), at: r.created_at, width: r.width, height: r.height }); }
      cursor = j.next_cursor; if (!cursor) break;
    }
  }
  return out.sort((x, y) => y.at.localeCompare(x.at));
}
/** Cached for one minute; uploads and deletions refresh it at once through the "media" tag. */
export const listMedia = unstable_cache(fetchMedia, ["tas-media"], { revalidate: 60, tags: ["media"] });

/** Parameters for a browser upload straight to Cloudinary. The secret never leaves the server. */
export function signUpload() {
  const k = cfg(); if (!k) return null;
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHash("sha1").update(`asset_folder=${FOLDER}&folder=${FOLDER}&timestamp=${timestamp}${k.s}`).digest("hex");
  return { cloud: k.c, apiKey: k.k, timestamp, signature, folder: FOLDER };
}
export async function deleteMedia(id: string) {
  const k = cfg(); if (!k) return false; const [type, ...rest] = id.split(":"); const publicId = rest.join(":");
  if (!["image", "video", "raw"].includes(type) || !publicId.startsWith(FOLDER + "/")) return false;
  const res = await fetch(`https://api.cloudinary.com/v1_1/${k.c}/resources/${type}/upload?public_ids[]=${encodeURIComponent(publicId)}`, { method: "DELETE", headers: { authorization: "Basic " + Buffer.from(`${k.k}:${k.s}`).toString("base64") } });
  return res.ok;
}
