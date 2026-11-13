import { getApplicantEmail } from "@/lib/otp";
import { studentResources } from "@/lib/resources";
/** RES: the signed-in student's released resources, grouped by programme and module on the client. */
export async function GET() {
  const email = await getApplicantEmail(); if (!email) return Response.json({ error: "Sign in again." }, { status: 401 });
  const rs = await studentResources(email);
  return Response.json({ items: rs.map((r) => { const v = r.versions.find((x) => x.version === r.version); return { id: r.id, title: r.title, description: r.description, programme: r.programme?.name ?? "", programmeId: r.programmeId, module: r.module ?? "General", topic: r.topic, kind: r.kind, licence: r.licence, viewOnly: r.viewOnly, link: !!v?.url, size: v?.size ?? null, updated: r.updatedAt.toISOString().slice(0, 10) }; }) }, { headers: { "cache-control": "private, no-store" } });
}
