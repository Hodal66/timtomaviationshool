import { zipSync } from "fflate";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getApplicantEmail } from "@/lib/otp";
import { studentScopes, studentWhere, REVIEWERS } from "@/lib/resources";
/** RES: every downloadable resource of a module in one ZIP. View-only items are left out; links are listed in links.txt. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams; const programmeId = q.get("programmeId") ?? "", module = q.get("module") ?? "";
  const s = await getSession(); let where: object;
  if (s && REVIEWERS.includes(s.role)) where = { programmeId, deletedAt: null, ...(module ? { module } : {}) };
  else { const email = await getApplicantEmail(); const sc = email ? (await studentScopes(email)).find((x) => x.programmeId === programmeId) : null; if (!sc) return new Response("Not available", { status: 403 }); where = { ...studentWhere(programmeId, new Date(), sc.classGroupId), ...(module ? { module } : {}), viewOnly: false }; }
  const rs = await db.resource.findMany({ where, include: { versions: true } }); const files: Record<string, Uint8Array> = {}; const links: string[] = []; const seen = new Set<string>();
  for (const r of rs) { const v = r.versions.find((x) => x.version === r.version); if (!v) continue; if (v.url) { links.push(`${r.title}: ${v.url}`); continue; } if (!v.data) continue;
    let n = `${(r.module ?? "General").replace(/[\\/:*?"<>|]/g, "_")}/${(v.filename ?? r.title).replace(/[\\/:*?"<>|]/g, "_")}`; while (seen.has(n)) n = n.replace(/(\.[^.]*)?$/, "-2$1"); seen.add(n); files[n] = new Uint8Array(v.data); }
  if (links.length) files["links.txt"] = new TextEncoder().encode(links.join("\n") + "\n"); if (!Object.keys(files).length) return new Response("Nothing to download.", { status: 409 });
  await db.resource.updateMany({ where: { id: { in: rs.map((r) => r.id) } }, data: { downloads: { increment: 1 } } });
  return new Response(Buffer.from(zipSync(files, { level: 6 })), { headers: { "content-type": "application/zip", "content-disposition": `attachment; filename="${(module || "resources").replace(/[^\w\- ]/g, "_")}.zip"`, "cache-control": "private, no-store" } });
}
