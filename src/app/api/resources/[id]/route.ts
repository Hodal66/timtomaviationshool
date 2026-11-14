import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getApplicantEmail } from "@/lib/otp";
import { staffCanSee, studentScopes, studentWhere, AUTHORS } from "@/lib/resources";
const ext: Record<string, string> = { "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg", "video/mp4": "mp4", "audio/mpeg": "mp3" };
/** RES: open a resource in the browser (inline) or download it. View-only resources are never sent as a download to students. Links redirect. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id; const q = new URL(req.url).searchParams; const dl = q.get("dl") === "1";
  const r = await db.resource.findUnique({ where: { id } }); if (!r) return new Response("Not found", { status: 404 });
  const s = await getSession(); let staff = false;
  if (s && AUTHORS.includes(s.role)) { if (!staffCanSee({ uid: s.uid, name: s.name, role: s.role }, r)) return new Response("Not allowed", { status: 403 }); staff = true; }
  else { const email = await getApplicantEmail(); const sc = (email ? await studentScopes(email) : []).filter((x) => x.programmeId === r.programmeId); let ok = false; for (const x of sc) if ((await db.resource.count({ where: { id, ...studentWhere(x.programmeId, new Date(), x.classGroupId) } })) > 0) ok = true; if (!ok) return new Response("Not available", { status: 403 }); }
  if (dl && r.viewOnly && !staff) return new Response("This resource is view-only.", { status: 403 });
  const vn = staff && q.get("v") ? Number(q.get("v")) : r.version; const v = await db.resourceVersion.findUnique({ where: { resourceId_version: { resourceId: id, version: vn } } }); if (!v) return new Response("Not found", { status: 404 });
  await db.resource.update({ where: { id }, data: dl ? { downloads: { increment: 1 } } : { views: { increment: 1 } } });
  if (v.url) return Response.redirect(v.url, 302);
  const name = (v.filename ?? `${r.title}.${ext[v.mime ?? ""] ?? "bin"}`).replace(/"/g, "");
  const h: Record<string, string> = { "content-type": v.mime ?? "application/octet-stream", "content-disposition": `${dl ? "attachment" : "inline"}; filename="${name}"`, "cache-control": "private, no-store", "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox" };
  return new Response(new Uint8Array(v.data ?? new Uint8Array()), { headers: h });
}
