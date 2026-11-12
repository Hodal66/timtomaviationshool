import Image from "next/image";
import type { Metadata } from "next";
import { Reveal } from "@/components/Reveal";
import { Particles } from "@/components/Particles";
import { SITE } from "@/lib/site";
export const metadata: Metadata = { title: "About | Timtom Aviation School", description: "About Timtom Aviation School: who we are, where we teach and how you can study with us.", alternates: { canonical: "/about" } };

export default function About() {
  return (<>
    <section className="cathead"><Particles density={26000} /><div className="wrap" style={{ position: "relative" }}>
      <Reveal className="shead"><span className="eyebrow">About the School</span><h1>Training for people who want to work in aviation</h1><p className="lead">{SITE.about}</p></Reveal></div></section>
    <section className="sx"><div className="wrap split">
      <Reveal><div className="shead" style={{ marginBottom: 20 }}><span className="eyebrow">Our aim</span><h2>An African hub for aviation knowledge</h2></div>
        <div className="prose"><p>{SITE.mission}</p><p>We teach aviation management, airport operations, cabin crew, cargo, travel and tourism, and ICT. Each programme has its own page with its details, intakes and fees.</p></div></Reveal>
      <Reveal delay={100} className="pic"><div className="im"><Image src="/images/site/hero-d.jpg" alt="A trainer and students in a Timtom training room" fill sizes="(max-width:860px) 100vw, 560px" loading="lazy" /></div></Reveal>
    </div></section>
    <section className="sx soft"><div className="wrap"><Reveal className="shead"><span className="eyebrow">How we teach</span><h2>Where and when you can study</h2></Reveal>
      <div className="grid-cards">
        <Reveal><div className="card2"><h3>Three branches</h3><p>{SITE.branches.join(", ")}. Each programme page shows which branches have an open intake.</p></div></Reveal>
        <Reveal delay={80}><div className="card2"><h3>Four intakes a year</h3><p>New intakes start in January, April, July and October.</p></div></Reveal>
        <Reveal delay={160}><div className="card2"><h3>Weekday or weekend</h3><p>Weekday classes run Monday to Friday. Weekend classes run Saturday and Sunday, 9:00 AM to 2:00 PM.</p></div></Reveal>
      </div></div></section>
    <section className="wrap" style={{ padding: "clamp(48px,7vw,96px) 0" }}><Reveal className="band"><Particles color="255,255,255" density={9000} /><h2>Ready to join us?</h2><p>Browse the programmes and apply online.</p>
      <div className="acts"><a className="btn cta" href="/apply">Apply Now</a><a className="btn onnavy" href="/courses">Explore Courses</a></div></Reveal></section></>);
}
