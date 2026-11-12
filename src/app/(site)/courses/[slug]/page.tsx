import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { asFaqs, asModules, categoryLabel, MODE_TEXT, SESSION_TEXT, themeOf } from "@/lib/catalogue";
import { listOfferings } from "@/lib/offerings";
import { Motif } from "@/components/Motif";
import { ApplyLink, Track } from "@/components/Track";
import { enquire } from "./actions";
export const revalidate = 60;

async function load(slug: string, preview: boolean) {
  const p = await db.programme.findUnique({ where: { slug } });
  if (!p) return null;
  if (p.status !== "PUBLISHED" && !preview) return null;
  return p;
}
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await db.programme.findUnique({ where: { slug: (await params).slug } });
  return p?.status === "PUBLISHED" ? { title: `${p.name} · Timtom Aviation School`, description: p.summary ?? undefined } : { title: "Course" };
}

export default async function Course({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ preview?: string; sent?: string }> }) {
  const { slug } = await params; const sp = await searchParams;
  const staff = sp.preview ? await getSession() : null;
  const p = await load(slug, !!staff);
  if (!p) notFound();
  const t = themeOf(p.visualTheme);
  const offerings = await listOfferings(p.id, { onlyOpen: !staff });
  const mods = asModules(p.modules), faqs = asFaqs(p.faqs);
  const related = await db.programme.findMany({ where: { status: "PUBLISHED", type: p.type, id: { not: p.id } }, take: 3, select: { id: true, slug: true, name: true, summary: true } });
  const next = offerings.find((o) => o.accepting);
  const apply = (o?: { id: string }) => `/apply?course=${p.slug}${o ? `&offering=${o.id}` : ""}`;
  const style = { "--dark": t.dark, "--acc": t.accent, "--soft": t.soft, "--line": t.line } as React.CSSProperties;
  return (<div style={style}>
    {!staff && <Track programmeId={p.id} />}
    {staff && p.status !== "PUBLISHED" && <div className="notice wrap" style={{ marginTop: 12 }}><b>Preview.</b> Status: {p.status}. This page is not public yet.</div>}
    <section className="hero"><div className="wrap">
      <div><span className="eyebrow onhero">{categoryLabel(p.type)}</span><h1>{p.name}</h1><p className="lead">{p.summary}</p>
        <div className="facts">{p.durationMonths && <span>{p.durationMonths} months</span>}{p.deliveryModes.length > 0 && <span>{p.deliveryModes.map((m) => MODE_TEXT[m] ?? m).join(" · ")}</span>}
          {next && <span>Next intake: {next.intake.label}</span>}{p.feeRwf != null && <span>Tuition RWF {p.feeRwf.toLocaleString("en-US")}</span>}</div>
        <p><ApplyLink className="btn acc" href={apply(next)} programmeId={p.id}>Apply now</ApplyLink></p></div>
      <div className="art">{p.heroImage ? <img src={p.heroImage} alt="" style={{ width: "100%", borderRadius: 12 }} /> : <><Motif theme={p.visualTheme} /><div className="cap">Illustration, not a photograph of the School.</div></>}</div>
    </div></section>

    <section className="sec"><div className="wrap two">
      <div><h2>About the course</h2><p style={{ maxWidth: "65ch", whiteSpace: "pre-line" }}>{p.description}</p>
        <p>{p.qualificationType && <span className="tag">{p.qualificationType}</span>} {p.awardingBody && <span className="tag">Certified by {p.awardingBody}</span>}</p></div>
      {p.objectives.length > 0 && <div><h2>What you will learn</h2><ul className="ol">{p.objectives.map((o, i) => <li key={i}>{o}</li>)}</ul></div>}
    </div></section>

    {mods.length > 0 && <section className="sec tint"><div className="wrap"><h2>Course modules</h2>
      <div className="grid3">{mods.map((m, i) => <div className="tile" key={i}><h3>{m.name}</h3>{m.description && <p style={{ margin: 0, color: "var(--muted)" }}>{m.description}</p>}</div>)}</div></div></section>}

    <section className="sec"><div className="wrap two">
      {p.entryRequirements.length > 0 ? <div><h2>Admission requirements</h2><ul className="ol">{p.entryRequirements.map((r, i) => <li key={i}>{r}</li>)}</ul></div> : <div><h2>Admission requirements</h2><p>Ask admissions for the entry requirements of this course.</p></div>}
      <div><h2>Fees and registration</h2>
        {p.feeRwf != null ? <p>Tuition: <b>RWF {p.feeRwf.toLocaleString("en-US")}</b>{p.feeUsd != null && <> (USD {p.feeUsd.toLocaleString("en-US")})</>}</p> : <p>Fees for this course are confirmed by admissions.</p>}
        {p.registrationFeeRwf != null && <p>Registration fee: <b>RWF {p.registrationFeeRwf.toLocaleString("en-US")}</b>, invoiced when you apply.</p>}
        <p style={{ color: "var(--muted)" }}>After you apply, your invoice shows the amount, a unique payment reference and the accepted payment methods. Payment is confirmed by the School before your status changes.</p></div>
    </div></section>

    <section className="sec tint"><div className="wrap"><h2>Upcoming intakes</h2>
      {offerings.length === 0 ? <p>No intake is open for applications right now. Ask admissions to be told when one opens.</p> :
        <div className="tbl"><table><thead><tr><th>Intake</th><th>Branch</th><th>Schedule</th><th>Seats left</th><th>Apply by</th><th></th></tr></thead><tbody>
          {offerings.map((o) => (<tr key={o.id}><td>{o.intake.label}</td><td>{o.branch.name}</td><td style={{ whiteSpace: "normal" }}>{SESSION_TEXT[o.session]}</td><td>{o.seatsLeft}</td>
            <td>{o.deadline ? o.deadline.toISOString().slice(0, 10) : "Open"}</td>
            <td>{o.accepting ? <ApplyLink className="btn" href={apply(o)} programmeId={p.id}>Apply</ApplyLink> : <span className="pill warn">{o.seatsLeft === 0 ? "Full" : o.pastDeadline ? "Closed" : "Not open"}</span>}</td></tr>))}
        </tbody></table></div>}</div></section>

    {p.careers.length > 0 && <section className="sec"><div className="wrap"><h2>Career pathways</h2><ul className="ol">{p.careers.map((c, i) => <li key={i}>{c}</li>)}</ul>
      <p style={{ color: "var(--muted)" }}>These are possible directions. Completing the course does not guarantee a job.</p></div></section>}

    {faqs.length > 0 && <section className="sec tint"><div className="wrap faq"><h2>Frequently asked questions</h2>{faqs.map((f, i) => <details key={i}><summary>{f.q}</summary><p>{f.a}</p></details>)}</div></section>}

    {related.length > 0 && <section className="sec"><div className="wrap"><h2>Related courses</h2><div className="grid3">{related.map((r) => <a className="tile link" key={r.id} href={`/courses/${r.slug}`}><h3>{r.name}</h3><p style={{ margin: 0, color: "var(--muted)" }}>{r.summary}</p></a>)}</div></div></section>}

    <section className="sec"><div className="wrap two">
      <div className="cta"><h2 style={{ color: "#fff" }}>Ready to apply?</h2><p>Your course is filled in for you.</p><ApplyLink className="btn acc" href={apply(next)} programmeId={p.id}>Apply now</ApplyLink></div>
      <form action={enquire} className="form"><h2>Ask a question</h2><input type="hidden" name="programmeId" value={p.id} /><input type="hidden" name="slug" value={p.slug!} />
        <label htmlFor="name">Your name</label><input id="name" name="name" required />
        <label htmlFor="contact">Phone or email</label><input id="contact" name="contact" required />
        <label htmlFor="message">Question</label><textarea id="message" name="message" rows={3} />
        <button className="btn" type="submit">Send</button>{sp.sent && <span className="pill ok" role="status">Thank you. Admissions will contact you.</span>}
      </form>
    </div></section>
  </div>);
}
