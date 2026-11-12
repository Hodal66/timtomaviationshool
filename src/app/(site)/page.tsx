import { db } from "@/lib/db";
import { CATEGORIES, categoryLabel } from "@/lib/catalogue";
import { Track } from "@/components/Track";
export const revalidate = 60;

export default async function Home() {
  const courses = await db.programme.findMany({ where: { status: "PUBLISHED" }, orderBy: { name: "asc" }, select: { id: true, slug: true, name: true, summary: true, type: true } });
  const counts = new Map<string, number>(); courses.forEach((c) => counts.set(c.type, (counts.get(c.type) ?? 0) + 1));
  return (<>
    <Track />
    <section className="hero"><div className="wrap" style={{ gridTemplateColumns: "1fr" }}>
      <div><span className="eyebrow">Kigali · Nyamata · Goma</span>
        <h1>Train for a career in aviation</h1>
        <p className="lead">Browse the School’s programmes, choose an intake and apply online from your phone.</p>
        <p><a className="btn acc" href="/courses">See courses</a> <a className="btn alt" href="/track">Track your application</a></p></div>
    </div></section>
    <section className="sec"><div className="wrap"><h2>Programme categories</h2>
      <div className="grid3">{CATEGORIES.map((c) => (<div className="tile" key={c.type}><h3>{c.label}</h3><p style={{ margin: "0 0 8px", color: "var(--muted)" }}>{c.blurb}</p><span className="tag">{counts.get(c.type) ?? 0} open for viewing</span></div>))}</div></div></section>
    <section className="sec tint"><div className="wrap"><h2>Courses</h2>
      {courses.length === 0 ? <p className="notice">Approved courses will appear here as soon as the School publishes them.</p> :
        <div className="grid3">{courses.map((c) => (<a className="tile link" key={c.id} href={`/courses/${c.slug}`}><span className="tag">{categoryLabel(c.type)}</span><h3 style={{ marginTop: 8 }}>{c.name}</h3><p style={{ margin: 0, color: "var(--muted)" }}>{c.summary}</p></a>))}</div>}
    </div></section>
  </>);
}
