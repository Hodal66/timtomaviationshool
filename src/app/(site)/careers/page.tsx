import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { Reveal } from "@/components/Reveal";
import { openVacancies } from "@/lib/recruitment";
export const revalidate = 60;
export const metadata: Metadata = { title: "Teach with us | Timtom Aviation School", description: "Open lecturer positions at Timtom Aviation School. Apply online with your CV.", alternates: { canonical: "/careers" } };
const list = unstable_cache(async () => (await openVacancies()).map((v) => ({ slug: v.slug, title: v.title, subjects: v.subjects, branch: v.branch?.name ?? null, closesOn: v.closesOn?.toISOString().slice(0, 10) ?? null, intro: v.description.slice(0, 220) })), ["careers-list"], { revalidate: 60, tags: ["careers"] });

/** LEC-07: published lecturer vacancies. */
export default async function Careers() {
  const vs = await list();
  return (<>
    <section className="pagehead"><div className="wrap"><Reveal className="shead"><span className="eyebrow">Careers</span><h1>Teach with us</h1><p className="lead">We work with airline, airport and travel professionals who want to train the next generation. Many of our lecturers teach around their shifts.</p></Reveal></div></section>
    <section className="sx" style={{ paddingTop: 24 }}><div className="wrap">
      {vs.length === 0 ? <p className="empty">There are no open positions right now. Check again soon.</p> :
        <ul className="vstack" style={{ listStyle: "none", padding: 0, gap: 16 }}>{vs.map((v) => <li key={v.slug} className="panel2" data-vacancy={v.slug}>
          <h2 style={{ fontSize: "1.35rem", margin: "0 0 6px" }}><a href={`/careers/${v.slug}`}>{v.title}</a></h2>
          <p style={{ margin: "0 0 8px", color: "var(--muted)" }}>{[v.branch, v.subjects.join(", "), v.closesOn && `Apply by ${v.closesOn}`].filter(Boolean).join(" · ")}</p>
          <p style={{ margin: "0 0 12px" }}>{v.intro}{v.intro.length >= 220 ? "…" : ""}</p><a className="btn pri sm" href={`/careers/${v.slug}`}>View and apply</a></li>)}</ul>}
    </div></section></>);
}
