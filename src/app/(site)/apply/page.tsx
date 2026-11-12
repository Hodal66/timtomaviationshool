import type { Metadata } from "next";
import { db } from "@/lib/db";
import { upcomingIntakes } from "@/lib/intakes";
import { Track } from "@/components/Track";
import { Reveal } from "@/components/Reveal";
import { Wizard } from "./Wizard";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Apply | Timtom Aviation School", description: "Apply to Timtom Aviation School online, at any time. Your progress is saved automatically.", robots: { index: false } };

export default async function Apply({ searchParams }: { searchParams: Promise<{ course?: string; branch?: string; session?: string; draft?: string }> }) {
  const sp = await searchParams;
  const [courses, branches] = await Promise.all([
    db.programme.findMany({ where: { status: "PUBLISHED", slug: { not: null } }, orderBy: { name: "asc" }, select: { id: true, slug: true, name: true } }),
    db.branch.findMany({ orderBy: { code: "asc" }, select: { id: true, name: true } }),
  ]);
  const known = courses.find((c) => c.slug === sp.course);
  const starts = upcomingIntakes(4).map((s) => ({ key: s.key, label: s.label }));
  return (<><Track programmeId={known?.id} />
    <section className="pagehead"><div className="wrap"><Reveal className="shead"><span className="eyebrow">Apply online</span><h1>Start your application</h1>
      <p className="lead">Registration is open all year. Five short steps, saved automatically, so you can stop and continue any time.</p></Reveal></div></section>
    <section className="sx" style={{ paddingTop: 24 }}><div className="wrap wzwrap">
      <Wizard programmes={courses.map((c) => ({ slug: c.slug!, name: c.name }))} branches={branches} starts={starts}
        initial={{ course: known?.slug ?? undefined, branch: branches.find((b) => b.id === sp.branch)?.id, session: sp.session === "WEEKEND" ? "WEEKEND" : undefined, draft: sp.draft }} /></div></section></>);
}
