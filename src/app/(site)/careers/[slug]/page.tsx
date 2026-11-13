import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { Reveal } from "@/components/Reveal";
import { JobApply } from "@/components/JobApply";
import { openVacancy } from "@/lib/recruitment";
export const revalidate = 60;
export const dynamicParams = true;
export function generateStaticParams() { return []; }
const get = unstable_cache(async (slug: string) => { const v = await openVacancy(slug); return v && { slug: v.slug, title: v.title, description: v.description, subjects: v.subjects, requirements: v.requirements, branch: v.branch?.name ?? null, closesOn: v.closesOn?.toISOString().slice(0, 10) ?? null, payModel: v.payModel }; }, ["vacancy-by-slug"], { revalidate: 60, tags: ["careers"] });
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> { const v = await get((await params).slug); return v ? { title: `${v.title} | Careers | Timtom Aviation School`, description: v.description.slice(0, 160), alternates: { canonical: `/careers/${v.slug}` } } : { title: "Vacancy closed" }; }

/** LEC-07/08: vacancy details and the online application with CV and screening questions. */
export default async function Vacancy({ params }: { params: Promise<{ slug: string }> }) {
  const v = await get((await params).slug); if (!v) notFound();
  return (<>
    <section className="pagehead"><div className="wrap"><Reveal className="shead"><span className="eyebrow">Careers</span><h1>{v.title}</h1><p className="lead">{[v.branch, v.subjects.join(", "), v.closesOn && `Apply by ${v.closesOn}`].filter(Boolean).join(" · ")}</p></Reveal></div></section>
    <section className="sx" style={{ paddingTop: 24 }}><div className="wrap split" style={{ alignItems: "start" }}>
      <div className="panel2 vstack" style={{ gap: 12 }}><h2 style={{ fontSize: "1.3rem", margin: 0 }}>About the role</h2>{v.description.split(/\n+/).map((p, i) => <p key={i} style={{ margin: 0 }}>{p}</p>)}
        {v.requirements.length > 0 && <><h3 style={{ margin: "8px 0 0" }}>What we look for</h3><ul>{v.requirements.map((r) => <li key={r}>{r}</li>)}</ul></>}</div>
      <div className="panel2"><h2 style={{ fontSize: "1.3rem", marginBottom: 14 }}>Apply</h2><JobApply slug={v.slug} requirements={v.requirements} /></div>
    </div></section></>);
}
