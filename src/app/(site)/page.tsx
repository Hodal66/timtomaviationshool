import Image from "next/image";
import type { Metadata } from "next";
import { Particles } from "@/components/Particles";
import { Reveal } from "@/components/Reveal";
import { CourseCard } from "@/components/CourseCard";
import { JsonLd } from "@/components/Json";
import { Track } from "@/components/Track";
import { featured, getCatalogue } from "@/lib/catalogue-data";
import { SITE } from "@/lib/site";
import { Gallery } from "@/components/Gallery";
import { listMedia, cloudinaryReady } from "@/lib/cloudinary";
export const revalidate = 60;
export const metadata: Metadata = {
  title: "Timtom Aviation School | Aviation, Airport, Travel and Tourism Training in Rwanda",
  description: "Professional aviation, airport operations, travel, tourism and ICT training at Timtom Aviation School. Browse programmes and apply online.",
  alternates: { canonical: "/" },
};

const I = (d: string) => <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
const STEPS = [
  { t: "Explore courses", p: "Browse programmes and compare.", i: I("M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3") },
  { t: "Select your programme", p: "Pick a course, branch and schedule.", i: I("M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11") },
  { t: "Complete the application", p: "Short form, saved as you go.", i: I("M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z") },
  { t: "Submit your documents", p: "Upload from your phone.", i: I("M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12") },
  { t: "Track your application", p: "Follow every status update.", i: I("M22 11.1V12a10 10 0 1 1-5.9-9.1M22 4L12 14l-3-3") },
];

export default async function Home() {
  const media = cloudinaryReady() ? await listMedia().catch(() => []) : [];
  const { courses } = await getCatalogue();
  const picks = featured(courses, 6);
  return (<>
    <Track />
    <JsonLd data={{ "@context": "https://schema.org", "@type": "EducationalOrganization", name: SITE.name, url: SITE.url, telephone: SITE.phone, email: SITE.email,
      address: { "@type": "PostalAddress", streetAddress: SITE.address, addressCountry: "RW" }, description: SITE.about, sameAs: SITE.socials.map((s) => s[1]) }} />

    <section className="hero2" aria-labelledby="hero-h">
      <Particles />
      <div className="wrap grid">
        <div className="copy">
          <Reveal className="fade"><span className="eyebrow">Timtom Aviation School</span></Reveal>
          <Reveal delay={80}><h1 id="hero-h">Your Journey Into the <span className="hl">World of Aviation</span> Starts Here.</h1></Reveal>
          <Reveal delay={160}><p className="lead">Build your future through professional aviation, airport operations, travel, tourism, and industry-focused training at Timtom Aviation School.</p></Reveal>
          <Reveal delay={240} className="acts"><a className="btn pri" href="/courses">Explore Courses</a><a className="btn cta" href="/apply">Apply Now</a></Reveal>
        </div>
        <Reveal delay={200} className="vis">
          <div className="ring" aria-hidden="true" />
          <div className="frame"><div className="reveal-img" style={{ position: "absolute", inset: 0 }}>
            <Image src="/images/site/hero-a.jpg" alt="Students training together at Timtom Aviation School" fill priority sizes="(max-width:900px) 100vw, 560px" /></div></div>
          <svg className="path" viewBox="0 0 400 140" aria-hidden="true"><path className="line" d="M0 120 C90 120 120 20 220 40 S340 90 400 10" /></svg>
        </Reveal>
      </div>
    </section>

    <section className="sx" aria-labelledby="prog-h"><div className="wrap">
      <Reveal className="shead"><span className="eyebrow">Programmes</span><h2 id="prog-h">Discover our programmes</h2><p className="lead">Industry-focused training across aviation, airports, travel, tourism and ICT.</p></Reveal>
      {picks.length === 0 ? <p className="empty">Programmes will appear here as soon as the School publishes them.</p> :
        <div className="cgrid2">{picks.map((c, i) => <Reveal key={c.id} delay={(i % 3) * 90}><CourseCard c={c} /></Reveal>)}</div>}
      <Reveal className="fade" delay={120}><p style={{ marginTop: 44, textAlign: "center" }}><a className="btn ghost" href="/courses">Explore All Courses</a></p></Reveal>
    </div></section>

    {media.length > 0 && <section className="sx" aria-labelledby="gal-h"><div className="wrap">
      <Reveal><span className="eyebrow">Gallery</span><h2 id="gal-h" style={{ margin: "14px 0 24px" }}>Life at Timtom Aviation School</h2></Reveal>
      <Gallery items={media} limit={8} /><p className="gal-more"><a className="btn pri" href="/gallery">View full gallery</a></p>
    </div></section>}
    <section className="sx soft" aria-labelledby="why-h"><div className="wrap split">
      <Reveal className="pic"><div className="im"><Image src="/images/site/hero-b.jpg" alt="Trainers and students in a Timtom classroom" fill sizes="(max-width:860px) 100vw, 560px" loading="lazy" /></div></Reveal>
      <div>
        <Reveal className="shead" ><span className="eyebrow">Why Timtom Aviation School</span><h2 id="why-h">Practical training, close to where you live</h2><p className="lead">{SITE.about}</p></Reveal>
        <Reveal delay={120}><ul className="ticks">
          <li><i aria-hidden="true">{I("M12 22s8-6.5 8-12a8 8 0 0 0-16 0c0 5.5 8 12 8 12zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z")}</i><div><b>Three branches</b><span>{SITE.branches.join(", ")}.</span></div></li>
          <li><i aria-hidden="true">{I("M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z")}</i><div><b>A new intake every three months</b><span>January, April, July and October.</span></div></li>
          <li><i aria-hidden="true">{I("M12 6v6l4 2M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z")}</i><div><b>Weekday and weekend sessions</b><span>Choose the schedule that fits your life.</span></div></li>
        </ul></Reveal>
        <Reveal delay={200}><p style={{ marginTop: 32 }}><a className="more" href="/about">About the School <span aria-hidden="true">→</span></a></p></Reveal>
      </div>
    </div></section>

    <section className="sx" aria-labelledby="how-h"><div className="wrap">
      <Reveal className="shead mid"><span className="eyebrow">How to apply</span><h2 id="how-h">Five simple steps to your place</h2></Reveal>
      <ol className="journey">{STEPS.map((s, i) => <Reveal as="li" key={s.t} delay={i * 90}><span className="ic">{s.i}</span><div><h3>{s.t}</h3><p>{s.p}</p></div></Reveal>)}</ol>
      <Reveal className="fade" delay={200}><p style={{ marginTop: 48, textAlign: "center" }}><a className="btn cta" href="/apply">Apply Now</a></p></Reveal>
    </div></section>

    <section className="wrap" style={{ paddingBottom: "clamp(48px,7vw,96px)" }} aria-labelledby="cta-h">
      <Reveal className="band"><Particles color="255,255,255" density={9000} />
        <h2 id="cta-h">Ready to Begin Your Aviation Career?</h2><p>Choose a programme and apply in a few minutes, from any device.</p>
        <div className="acts"><a className="btn cta" href="/apply">Apply Now</a><a className="btn onnavy" href="/courses">Explore Courses</a></div></Reveal>
    </section>
  </>);
}
