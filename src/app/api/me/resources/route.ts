import { db } from "@/lib/db";
import { getApplicantEmail } from "@/lib/otp";
import { studentResources } from "@/lib/resources";
/** LMS-01 / RES: the signed-in student's course spaces: announcements, syllabus modules and released resources. */
export async function GET() {
  const email = await getApplicantEmail(); if (!email) return Response.json({ error: "Sign in again." }, { status: 401 });
  const [rs, apps] = await Promise.all([studentResources(email), db.applicant.findMany({ where: { email, status: "ENROLLED" }, select: { classGroupId: true, programme: { select: { id: true, name: true, modules: true } } } })]);
  const gids = apps.map((a) => a.classGroupId).filter(Boolean) as string[]; const notes = gids.length ? await db.announcement.findMany({ where: { groupId: { in: gids } }, orderBy: { createdAt: "desc" }, take: 20 }) : [];
  const courses = apps.map((a) => ({ programmeId: a.programme.id, programme: a.programme.name, modules: (Array.isArray(a.programme.modules) ? a.programme.modules : []).map((m) => (typeof m === "string" ? { name: m, topics: [] } : { name: String((m as { name?: string }).name ?? ""), topics: ((m as { topics?: string[] }).topics ?? []).map(String) })).filter((m) => m.name),
    announcements: notes.filter((n) => n.groupId === a.classGroupId).map((n) => ({ id: n.id, title: n.title, body: n.body, by: n.createdBy, at: n.createdAt.toISOString().slice(0, 10) })) }));
  return Response.json({ courses, items: rs.map((r) => { const v = r.versions.find((x) => x.version === r.version); return { id: r.id, title: r.title, description: r.description, programme: r.programme?.name ?? "", programmeId: r.programmeId, module: r.module ?? "General", topic: r.topic, kind: r.kind, licence: r.licence, viewOnly: r.viewOnly, link: !!v?.url, size: v?.size ?? null, updated: r.updatedAt.toISOString().slice(0, 10) }; }) }, { headers: { "cache-control": "private, no-store" } });
}
