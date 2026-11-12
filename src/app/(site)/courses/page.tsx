import { db } from "@/lib/db";
import { CATEGORIES } from "@/lib/catalogue";
import { Track } from "@/components/Track";
export const revalidate = 60;
export const metadata = { title: "Courses · Timtom Aviation School" };

export default async function Courses() {
  const courses = await db.programme.findMany({ where: { status: "PUBLISHED" }, orderBy: { name: "asc" }, include: { offerings: { where: { status: "OPEN" }, select: { id: true } } } });
  return (<div className="wrap sec"><Track /><h1>Courses</h1>
    {courses.length === 0 && <p className="notice">No courses are published yet. Please check back soon.</p>}
    {CATEGORIES.map((cat) => { const list = courses.filter((c) => c.type === cat.type); if (!list.length) return null;
      return (<section key={cat.type} style={{ marginTop: 24 }}><h2>{cat.label}</h2>
        <div className="grid3">{list.map((c) => (<a key={c.id} href={`/courses/${c.slug}`} className="tile link"><h3>{c.name}</h3><p style={{ margin: "0 0 8px", color: "var(--muted)" }}>{c.summary}</p>
          <span className="tag">{c.durationMonths} months</span> <span className={`pill ${c.offerings.length ? "ok" : "warn"}`}>{c.offerings.length ? "Applications open" : "No open intake"}</span></a>))}</div></section>); })}
  </div>);
}
