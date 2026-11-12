import { db } from "@/lib/db";
import { GROUPS } from "@/lib/groups";
import { themeOf } from "@/lib/catalogue";
import { HeroSlider } from "@/components/HeroSlider";
import { Motif } from "@/components/Motif";
import { Track } from "@/components/Track";
export const revalidate = 60;

export default async function Home() {
  const courses = await db.programme.findMany({ where: { status: "PUBLISHED" }, orderBy: { code: "asc" },
    select: { id: true, code: true, slug: true, name: true, summary: true, type: true, qualificationType: true, feeRwf: true, heroImage: true, visualTheme: true } });
  courses.sort((a, b) => (Number(a.code.replace(/\D/g, "")) || 999) - (Number(b.code.replace(/\D/g, "")) || 999));
  const featured = [...courses].sort((a, b) => Number(!!b.heroImage) - Number(!!a.heroImage)).slice(0, 9);
  return (<>
    <Track />
    <HeroSlider enrollHref="/apply" />
    <section className="welcome"><svg viewBox="0 0 1440 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g stroke="#7C8BE0" strokeWidth="1" fill="none"><path d="M60 120 L90 125 L60 190 L200 210 L220 150 L90 125" /><path d="M400 180 L455 75 L410 210 L390 280" /><path d="M770 220 L940 235 L965 205 L775 225" /><path d="M1150 75 L1250 58 L1200 88 Z" /><path d="M1345 165 L1428 250 L1365 338 L1342 277 Z" /><path d="M540 340 L635 366 L680 300 L545 342" /></g>
      <g fill="#fff"><circle cx="60" cy="120" r="3" /><circle cx="90" cy="125" r="3" /><circle cx="200" cy="210" r="3" /><circle cx="455" cy="75" r="3" /><circle cx="390" cy="280" r="3" /><circle cx="940" cy="235" r="3" /><circle cx="965" cy="205" r="3" /><circle cx="1250" cy="58" r="3" /><circle cx="1428" cy="250" r="3" /><circle cx="1342" cy="277" r="3" /><circle cx="635" cy="366" r="3" /><circle cx="680" cy="300" r="3" /></g></svg>
      <div className="wrap"><h2>Welcome to<b>Timtom Aviation School</b></h2><p>Empowering future aviation professionals with world-class training and practical experience.</p>
        <a className="btn lg" href="/courses">Explore Courses</a></div></section>

    <section className="dots-bg"><div className="wrap about">
      <div className="pic"><img src="/images/site/hero-b.jpg" alt="Students and trainers in a Timtom classroom" loading="lazy" /><div className="badge"><i>Excellence in</i>Aviation</div></div>
      <div><span className="eyebrow">About Timtom Aviation</span><h2>Aviation training in Rwanda</h2><span className="rule" />
        <p>TIMTOM AVIATION is a private company which offers consultancy services in the field of management and also offers training in the field of aviation management, hospitality, tourism and ICT.</p>
        <p style={{ marginTop: 28 }}><a className="btn" href="/about">Learn More About Us</a></p></div>
    </div></section>

    <section className="dots-bg summary"><div className="wrap">
      <div className="ctr"><span className="eyebrow">Timtom Aviation School Courses Summary</span><h2>We Offer The Following Courses:</h2><span className="rule" />
        <p style={{ maxWidth: "60ch", margin: "0 auto", fontSize: 17 }}>Explore our diverse range of aviation, hospitality, and computer skills training programs designed to jumpstart your career.</p></div>
      <div className="sumgrid">{GROUPS.map((g) => { const list = courses.filter(g.test); if (list.length === 0) return null;
        return (<div className="sumcard" id={g.id} key={g.id}><h3><i>{g.n}</i>{g.title}</h3><ul>{list.map((c) => <li key={c.id}><a href={`/courses/${c.slug}`}>{c.name}</a></li>)}</ul></div>); })}</div>
      {courses.length === 0 && <p className="notice" style={{ marginTop: 24 }}>Approved courses will appear here as soon as the School publishes them.</p>}
    </div></section>

    <section style={{ padding: "72px 0", background: "#fff" }}><div className="wrap">
      <div className="ctr"><span className="eyebrow">Timtom Aviation School Courses</span><h2>Which Course do you want to cover?</h2>
        <p style={{ maxWidth: "62ch", margin: "12px auto 0", fontSize: 17 }}>We also offer other courses related to hospitality, tourism, and computer skills.</p></div>
      <div className="cgrid">{featured.map((c) => { const t = themeOf(c.visualTheme);
        return (<a key={c.id} href={`/courses/${c.slug}`} className="ccard" style={{ textDecoration: "none", color: "inherit" }}>
          {c.heroImage ? <div className="img"><img src={c.heroImage} alt="" loading="lazy" /></div> : <div className="img art" style={{ ["--d" as string]: t.dark, ["--l" as string]: t.line }}><Motif theme={c.visualTheme} /></div>}
          <div className="body"><h3>{c.name}</h3><p>{c.summary}</p>{c.feeRwf != null && <span className="fee">{c.feeRwf.toLocaleString("en-US")} Rwf</span>}<span className="more">Read More →</span></div></a>); })}</div>
      <p className="ctr" style={{ marginTop: 36 }}><a className="btn" href="/courses">View all {courses.length} courses</a></p>
    </div></section>
  </>);
}
