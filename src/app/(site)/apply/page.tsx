import type { Metadata } from "next";
import { db } from "@/lib/db";
import { openOfferingsByProgramme } from "@/lib/offerings";
import { Track } from "@/components/Track";
import { Reveal } from "@/components/Reveal";
import { Wizard } from "./Wizard";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Apply | Timtom Aviation School", description: "Apply to Timtom Aviation School online. Your progress is saved automatically.", robots: { index: false } };

export default async function Apply({ searchParams }: { searchParams: Promise<{ course?: string; offering?: string; draft?: string }> }) {
  const sp = await searchParams;
  const [courses, offs] = await Promise.all([db.programme.findMany({ where: { status: "PUBLISHED", slug: { not: null } }, orderBy: { name: "asc" }, select: { id: true, slug: true, name: true } }), openOfferingsByProgramme()]);
  const programmes = courses.map((c) => ({ slug: c.slug!, name: c.name, offerings: (offs.get(c.id) ?? []).map((o) => ({ id: o.id, intake: o.intake, branch: o.branch, session: o.session, seatsLeft: o.seatsLeft, deadline: o.deadline, accepting: o.accepting })) }));
  const known = programmes.find((p) => p.slug === sp.course);
  return (<><Track programmeId={known ? courses.find((c) => c.slug === known.slug)?.id : undefined} />
    <section className="pagehead"><div className="wrap"><Reveal className="shead" ><span className="eyebrow">Apply online</span><h1 style={{ fontSize: "clamp(2rem,1rem + 3vw,3.4rem)" }}>Start your application</h1>
      <p className="lead">Five short steps. Your progress is saved automatically, so you can stop and continue any time.</p></Reveal></div></section>
    <section className="sx" style={{ paddingTop: 24 }}><div className="wrap wzwrap">
      <Wizard programmes={programmes} initial={{ course: known?.slug, offering: sp.offering, draft: sp.draft }} /></div></section></>);
}
