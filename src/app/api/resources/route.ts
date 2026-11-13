import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { createResource, addVersion, RES_MAX, type Meta } from "@/lib/resources";
/** RES: upload a new resource, or a new version of one (multipart form). */
export async function POST(req: Request) {
  const s = await getSession(); if (!s) return Response.json({ error: "Sign in again." }, { status: 401 }); const a = { uid: s.uid, name: s.name, role: s.role };
  const f = await req.formData().catch(() => null); if (!f) return Response.json({ error: "Invalid form." }, { status: 400 });
  const file = f.get("file"); if (file instanceof File && file.size > RES_MAX) return Response.json({ error: "The file is larger than 4 MB. Compress it or add it as a link." }, { status: 413 });
  const src = { file: file instanceof File && file.size ? { name: file.name, type: file.type, bytes: new Uint8Array(await file.arrayBuffer()) } : null, url: String(f.get("url") ?? "") };
  const id = String(f.get("id") ?? "");
  if (id) { const err = await addVersion(a, id, src, String(f.get("note") ?? "")); revalidatePath("/resources"); return Response.json(err ? { error: err } : { ok: true, id }, { status: err ? 400 : 200 }); }
  const m = Object.fromEntries(["title", "description", "programmeId", "module", "topic", "kind", "tags", "language", "visibility", "releaseAt", "expiresAt", "licence", "viewOnly"].map((k) => [k, String(f.get(k) ?? "")])) as Meta;
  const r = await createResource(a, m, src); revalidatePath("/resources"); return typeof r === "string" ? Response.json({ error: r }, { status: 400 }) : Response.json({ ok: true, id: r.id });
}
