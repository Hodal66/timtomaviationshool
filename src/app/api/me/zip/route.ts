import { zipSync } from "fflate";
import { myApplication } from "@/lib/me";
import { allStudentDocs } from "@/lib/student-docs";
/** STU-05: every personal document in one ZIP file. */
export async function GET(req: Request) {
  const a = await myApplication(new URL(req.url).searchParams.get("a")); if (!a) return new Response("Forbidden", { status: 403 });
  const files = await allStudentDocs(a.id); if (!files.length) return new Response("No documents yet.", { status: 409 });
  const seen = new Set<string>(); const entries: Record<string, Uint8Array> = {}; for (const f of files) { let n = f.name.replace(/[\\:*?"<>|]/g, "_"); while (seen.has(n)) n = n.replace(/(\.[^.]*)?$/, "-2$1"); seen.add(n); entries[n] = f.bytes; }
  return new Response(Buffer.from(zipSync(entries, { level: 6 })), { headers: { "content-type": "application/zip", "content-disposition": `attachment; filename="My-documents-${a.reference}.zip"`, "cache-control": "private, no-store" } });
}
