import { db } from "@/lib/db";
import { unstable_cache } from "next/cache";
const getBranches = unstable_cache(() => db.branch.findMany({ orderBy: { code: "asc" }, select: { name: true } }), ["branches"], { revalidate: 300, tags: ["catalogue"] });
import { asFaqs, asModules, categoryLabel, MODE_TEXT, themeOf } from "@/lib/catalogue";
import { areaLabel, areaOf } from "@/lib/areas";
import { DOC_KINDS } from "@/lib/apply";
import { SESSIONS, upcomingIntakes } from "@/lib/intakes";
import { getCatalogue } from "@/lib/catalogue-data";
import { SITE } from "@/lib/site";
import { Reveal } from "./Reveal";
import { CourseCard, CourseImage } from "./CourseCard";
import { ApplyLink, Track } from "./Track";
import { EnquiryForm } from "./EnquiryForm";
import { JsonLd } from "./Json";
import { Particles } from "./Particles";
import type { Programme } from "@prisma/client";

/** The description minus the sentence already shown as the introduction, so nothing is said twice. */
export function aboutBody(summary: string | null, description: string | null) {
  const d = (description ?? "").trim(), s = (summary ?? "").trim().replace(/\.{3}$/, "");
  if (!d) return null;
  if (s && d.startsWith(s)) { const rest = d.slice(s.length).replace(/^[\s.…]+/, "").trim(); return rest.length > 20 ? rest : null; }
  return d === s ? null : d;
}

export async function CourseView({ p, preview = false }: { p: Programme; preview?: boolean }) {
  const t = themeOf(p.visualTheme);
  const [cat, branches] = await Promise.all([getCatalogue(), getBranches()]);
  const starts = upcomingIntakes(4);
  const area = areaOf(p), mods = asModules(p.modules), faqs = asFaqs(p.faqs), about = aboutBody(p.summary, p.description);
  const related = cat.courses.filter((c) => c.areaId === area && c.id !== p.id).slice(0, 3);
  const apply = `/apply?course=${p.slug}`;
  const info: [string, string][] = [["Subject area", areaLabel(area)], ["Qualification", p.qualificationType ?? categoryLabel(p.type)]];
  if (p.durationMonths) info.push(["Duration", `${p.durationMonths} months`]);
  if (p.deliveryModes.length) info.push(["Delivery", p.deliveryModes.map((m) => MODE_TEXT[m] ?? m).join(", ")]);
  if (p.feeRwf != null) info.push(["Tuition", `RWF ${p.feeRwf.toLocaleString("en-US")}`]);
  info.push(["Next intake", starts[0].label]);
  const card = { id: p.id, slug: p.slug!, code: p.code, name: p.name, summary: p.summary, durationMonths: p.durationMonths, heroImage: p.heroImage, visualTheme: p.visualTheme, areaLabel: areaLabel(area) };

  return (<div className="course-pad">
    {!preview && <Track programmeId={p.id} />}
    <JsonLd data={{ "@context": "https://schema.org", "@type": "Course", name: p.name, description: p.summary ?? p.description ?? undefined, url: `${SITE.url}/courses/${p.slug}`,
      provider: { "@type": "EducationalOrganization", name: SITE.name, url: SITE.url },
      ...(p.feeRwf != null ? { offers: { "@type": "Offer", price: p.feeRwf, priceCurrency: "RWF", category: "Tuition" } } : {}) }} />
    {preview && <div className="wrap"><p className="note" style={{ marginTop: 16 }}><b>Staff preview.</b> Status: {p.status}. {p.status === "PUBLISHED" ? "This page is public." : "This page is not public yet."}</p></div>}

    <section className="chero"><Particles density={30000} /><div className="wrap grid" style={{ position: "relative" }}>
      <div className="copy">
        <nav className="crumbs" aria-label="Breadcrumb"><a href="/courses">Courses</a> / <span>{areaLabel(area)}</span></nav>
        <Reveal><h1 style={{ fontSize: "clamp(2rem,1rem + 3vw,3.6rem)" }}>{p.name}</h1></Reveal>
        {p.summary && <Reveal delay={90}><p className="lead">{p.summary}</p></Reveal>}
        <Reveal delay={180} className="acts" ><ApplyLink className="btn cta" href={apply} programmeId={p.id}>Apply Now</ApplyLink>{" "}<a className="btn ghost" href="#start">Start dates and fees</a></Reveal>
      </div>
      <Reveal delay={120}><div className="im" style={{ position: "relative", background: t.dark }}><div className="reveal-img" style={{ position: "absolute", inset: 0 }}><CourseImage c={card} sizes="(max-width:760px) 100vw, 560px" priority /></div></div></Reveal>
    </div></section>

    <div className="wrap"><Reveal><dl className="kinfo">{info.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></Reveal></div>

    {(about || p.objectives.length > 0) && <section className="sx"><div className="wrap split" style={{ alignItems: "start" }}>
      {about && <Reveal><div className="shead" style={{ marginBottom: 20 }}><span className="eyebrow">About this programme</span><h2>What the programme covers</h2></div><div className="prose"><p>{about}</p></div></Reveal>}
      {p.objectives.length > 0 && <Reveal delay={100}><div className="shead" style={{ marginBottom: 20 }}><span className="eyebrow">Outcomes</span><h2>What you will learn</h2></div><ul className="list">{p.objectives.map((o, i) => <li key={i}>{o}</li>)}</ul></Reveal>}
    </div></section>}

    {mods.length > 0 && <section className="sx soft"><div className="wrap"><Reveal className="shead"><span className="eyebrow">Curriculum</span><h2>Course modules</h2></Reveal>
      <div className="mods">{mods.map((m, i) => <Reveal key={i} delay={(i % 3) * 80}><div className="mod"><span className="n">Module {i + 1}</span><h3>{m.name}</h3>{m.description && <p>{m.description}</p>}</div></Reveal>)}</div></div></section>}

    <section className="sx"><div className="wrap split" style={{ alignItems: "start" }}>
      <Reveal><div className="shead" style={{ marginBottom: 20 }}><span className="eyebrow">Admission</span><h2>Admission requirements</h2></div>
        {p.entryRequirements.length > 0 ? <ul className="list">{p.entryRequirements.map((r, i) => <li key={i}>{r}</li>)}</ul> : <p className="lead">Admissions confirms the entry requirements for this programme when you apply.</p>}</Reveal>
      <Reveal delay={100}><div className="panel2"><h3 style={{ marginBottom: 12 }}>Documents you will need</h3><ul className="list">{DOC_KINDS.map((d) => <li key={d}>{d}</li>)}</ul>
        <p style={{ marginTop: 16, color: "var(--mute)", fontSize: ".95rem" }}>Applicants under 18 also need a parent or guardian. You can upload documents while you apply or later from your tracking page.</p></div></Reveal>
    </div></section>

    <section className="sx sky" id="start"><div className="wrap">
      <Reveal className="shead"><span className="eyebrow">Start dates and fees</span><h2>Apply at any time</h2>
        <p className="lead">{p.feeRwf != null && <>Tuition is <b>RWF {p.feeRwf.toLocaleString("en-US")}</b>{p.feeUsd != null && <> (USD {p.feeUsd.toLocaleString("en-US")})</>}. </>}{p.registrationFeeRwf != null && <>A registration fee of <b>RWF {p.registrationFeeRwf.toLocaleString("en-US")}</b> is invoiced when you apply. </>}A new intake starts every three months. Register whenever you are ready and admissions places you in the next suitable intake.</p></Reveal>
      <div className="grid-cards">
        <Reveal><div className="card2"><h3>Next start dates</h3><ul className="list">{starts.map((s) => <li key={s.key}>{s.label}</li>)}</ul></div></Reveal>
        <Reveal delay={80}><div className="card2"><h3>Choose your schedule</h3><ul className="list">{Object.values(SESSIONS).map((x) => <li key={x.label}><span><b>{x.label}</b><br />{x.detail}</span></li>)}</ul></div></Reveal>
        <Reveal delay={160}><div className="card2"><h3>Choose your branch</h3><ul className="list">{branches.map((b) => <li key={b.name}>{b.name}</li>)}</ul>
          <p style={{ marginTop: 6 }}><ApplyLink className="btn cta sm" href={apply} programmeId={p.id}>Apply Now</ApplyLink></p></div></Reveal>
      </div>
      {p.feeRwf != null || p.registrationFeeRwf != null ? <p style={{ marginTop: 22, color: "var(--mute)" }}>Payments are confirmed by the School before your status changes.</p> : <p style={{ marginTop: 22, color: "var(--mute)" }}>Admissions confirms the fees for this programme when you apply.</p>}
    </div></section>

    {p.careers.length > 0 && <section className="sx"><div className="wrap"><Reveal className="shead"><span className="eyebrow">After the programme</span><h2>Career pathways</h2><p className="lead">Possible directions. Completing a programme does not guarantee employment.</p></Reveal>
      <Reveal><ul className="list" style={{ maxWidth: 720 }}>{p.careers.map((c, i) => <li key={i}>{c}</li>)}</ul></Reveal></div></section>}

    <section className="sx soft" id="ask"><div className="wrap split" style={{ alignItems: "start" }}>
      <div>{faqs.length > 0 ? <><Reveal className="shead"><span className="eyebrow">Questions</span><h2>Frequently asked questions</h2></Reveal><div className="faq">{faqs.map((f, i) => <details key={i}><summary>{f.q}</summary><p>{f.a}</p></details>)}</div></>
        : <Reveal className="shead"><span className="eyebrow">Questions</span><h2>Ask admissions</h2><p className="lead">Not sure about entry requirements, fees or intakes? Send a question and we will reply.</p></Reveal>}</div>
      <Reveal delay={100}><div className="panel2"><h3 style={{ marginBottom: 16 }}>{faqs.length > 0 ? "Still have a question?" : "Your question"}</h3><EnquiryForm programmeId={p.id} id="enq" /></div></Reveal>
    </div></section>

    {related.length > 0 && <section className="sx"><div className="wrap"><Reveal className="shead"><span className="eyebrow">Keep exploring</span><h2>Related programmes</h2></Reveal>
      <div className="cgrid2">{related.map((c, i) => <Reveal key={c.id} delay={i * 90}><CourseCard c={c} /></Reveal>)}</div></div></section>}

    <section className="wrap" style={{ paddingBottom: "clamp(48px,7vw,96px)" }}><Reveal className="band"><Particles color="255,255,255" density={9000} />
      <h2>Start your {p.name} journey</h2><p>Your programme is already selected when you apply.</p>
      <div className="acts"><ApplyLink className="btn cta" href={apply} programmeId={p.id}>Apply Now</ApplyLink></div></Reveal></section>

    <div className="stick"><ApplyLink className="btn cta" href={apply} programmeId={p.id}>Apply Now</ApplyLink></div>
  </div>);
}
