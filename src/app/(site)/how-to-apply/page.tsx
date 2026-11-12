import type { Metadata } from "next";
import { Reveal } from "@/components/Reveal";
import { Particles } from "@/components/Particles";
import { DOC_KINDS } from "@/lib/apply";
import { SITE } from "@/lib/site";
export const metadata: Metadata = { title: "Admissions | Timtom Aviation School", description: "How to apply to Timtom Aviation School: what you need, how payment works and how to track your application.", alternates: { canonical: "/how-to-apply" } };

const STEPS = [
  ["Choose a programme and intake", "Open a programme page, check the intakes, then press Apply. The programme is selected for you."],
  ["Complete the application", "Give your contact details and education. Your progress is saved, so you can stop and continue on any device."],
  ["Upload your documents", "Photograph or scan each document on your phone. You can also add them later from your tracking page."],
  ["Pay the registration fee", "If the programme has one, your invoice shows the amount and a payment reference. The School confirms the payment before your status changes."],
  ["Follow your application", "Your status moves from Submitted to Documents verified, Registration paid, Admitted and Enrolled."],
];

export default function Admissions() {
  return (<>
    <section className="cathead"><Particles density={26000} /><div className="wrap" style={{ position: "relative" }}>
      <Reveal className="shead"><span className="eyebrow">Admissions</span><h1>How to apply</h1><p className="lead">Everything you need before you start, in one place.</p></Reveal>
      <Reveal delay={100}><div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}><a className="btn cta" href="/apply">Apply Now</a><a className="btn ghost" href="/track">Track your application</a></div></Reveal></div></section>

    <section className="sx"><div className="wrap split" style={{ alignItems: "start" }}>
      <div><Reveal className="shead"><span className="eyebrow">The process</span><h2>From first click to your first class</h2></Reveal>
        <ol className="vstack" style={{ listStyle: "none", padding: 0, margin: 0, gap: 22 }}>{STEPS.map(([t, d], i) => <Reveal as="li" key={t} delay={i * 70}><div style={{ display: "grid", gridTemplateColumns: "44px 1fr", gap: 16 }}><span style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--sky)", color: "var(--blue)", display: "grid", placeItems: "center", fontWeight: 700 }}>{i + 1}</span><div><h3>{t}</h3><p style={{ color: "var(--mute)" }}>{d}</p></div></div></Reveal>)}</ol></div>
      <div className="vstack">
        <Reveal><div className="panel2"><h3 style={{ marginBottom: 12 }}>Documents to have ready</h3><ul className="list">{DOC_KINDS.map((d) => <li key={d}>{d}</li>)}</ul>
          <p style={{ marginTop: 14, color: "var(--mute)", fontSize: ".95rem" }}>Applicants under 18 also give a parent or guardian name and phone number. Each programme page lists any extra entry requirements.</p></div></Reveal>
        <Reveal delay={80}><div className="panel2"><h3 style={{ marginBottom: 12 }}>Intakes and sessions</h3><p style={{ color: "var(--mute)" }}>New intakes start in January, April, July and October at {SITE.branches.join(", ")}. Choose a weekday or weekend session when you apply.</p></div></Reveal>
        <Reveal delay={160}><div className="panel2"><h3 style={{ marginBottom: 12 }}>Need help?</h3><p style={{ color: "var(--mute)" }}>Call <a href={`tel:${SITE.phone}`}>{SITE.phoneDisplay}</a> or email <a href={`mailto:${SITE.email}`}>{SITE.email}</a>.</p></div></Reveal>
      </div></div></section></>);
}
