import { db } from "@/lib/db";
import { listOfferings } from "@/lib/offerings";
import { REQUIRED_DOCS, SESSION_TEXT } from "@/lib/catalogue";
import { Track } from "@/components/Track";
import { Wizard } from "./Wizard";
export const dynamic = "force-dynamic";
export const metadata = { title: "Apply · Timtom Aviation School" };

export default async function Apply({ searchParams }: { searchParams: Promise<{ course?: string; offering?: string; err?: string }> }) {
  const sp = await searchParams;
  const courses = await db.programme.findMany({ where: { status: "PUBLISHED" }, orderBy: { name: "asc" }, select: { slug: true, name: true } });
  const course = courses.find((c) => c.slug === sp.course);
  if (!course) return (<div className="wrap sec"><Track /><h1>Apply</h1><p>Choose the course you want to apply for.</p>
    {courses.length === 0 ? <p className="notice">No courses are open for applications yet.</p> : <div className="grid3">{courses.map((c) => <a key={c.slug} className="tile link" href={`/apply?course=${c.slug}`}><h3>{c.name}</h3></a>)}</div>}</div>);
  const p = (await db.programme.findUnique({ where: { slug: course.slug! } }))!;
  const offs = (await listOfferings(p.id, { onlyOpen: true })).map((o) => ({ id: o.id, label: `${o.intake.label} · ${o.branch.name} · ${SESSION_TEXT[o.session]}`, seatsLeft: o.seatsLeft, accepting: o.accepting }));
  return (<div className="wrap sec"><Track programmeId={p.id} /><h1>Apply</h1>
    {offs.length === 0 ? <p className="notice">No intake is open for {course.name} right now.</p> :
      <Wizard course={course.slug!} courseName={course.name} offerings={offs} offering={offs.some((o) => o.id === sp.offering) ? sp.offering! : ""} docs={REQUIRED_DOCS} err={sp.err} />}</div>);
}
