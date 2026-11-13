import { myApplication } from "@/lib/me";
import { studentDoc } from "@/lib/student-docs";
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams; const a = await myApplication(q.get("a")); if (!a) return new Response("Forbidden", { status: 403 });
  const d = await studentDoc(a.id, q.get("kind") ?? "", q.get("id") ?? undefined); if (typeof d === "string") return new Response(d, { status: 409 });
  return new Response(Buffer.from(d.bytes), { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="${d.name}"`, "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
}
