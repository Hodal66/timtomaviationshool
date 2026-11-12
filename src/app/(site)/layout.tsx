const PHONE = "+250788519634", MAIL = "info@timtomaviation.com", ADDR = "Kabeza road, KK 18 AV";
const I = (d: string) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;

export default function Site({ children }: { children: React.ReactNode }) {
  const wa = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, "");
  return (<div className="site">
    <div className="topbar"><div className="wrap">
      <a href={`tel:${PHONE}`}>{I("M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z")}(+250) 788 519 634</a>
      <a href={`mailto:${MAIL}`}>{I("M4 4h16v16H4zM4 7l8 6 8-6")}{MAIL}</a>
      <span>{I("M12 22s8-6.5 8-12a8 8 0 0 0-16 0c0 5.5 8 12 8 12zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z")}{ADDR}</span>
      {wa && <a href={`https://wa.me/${wa}`} style={{ marginLeft: "auto" }}>WhatsApp admissions</a>}
    </div></div>
    <header className="sh"><div className="wrap">
      <a href="/" className="logo" aria-label="Timtom Aviation home"><img src="/images/site/logo.png" alt="Timtom Aviation" width={140} height={56} /></a>
      <nav aria-label="Main"><a href="/">Home</a><a href="/courses">Courses</a><a href="/about">About Us</a><a href="/contact">Contact Us</a><a href="/track">Track application</a></nav>
      <a className="btn" href="/apply">Apply now</a>
    </div></header>
    <div style={{ flex: 1 }}>{children}</div>
    <footer className="sf">
      <div className="wrap cols">
        <div><h4>TIMTOM AVIATION SCHOOL</h4><p>To become an African hub in providing knowledge and consultancy service in the field of aviation, hospitality, tourism, and ICT.</p>
          <b style={{ color: "#fff", fontSize: 18 }}>Need a Consultation?</b><br /><a className="tel" href={`tel:${PHONE}`}>{PHONE}</a></div>
        <div><h4>All Courses Packages</h4><ul><li><a href="/courses">All Courses</a></li><li><a href="/courses#local-certificates">Local Certificates</a></li><li><a href="/courses#local-advanced">Local Advanced Certificates</a></li><li><a href="/courses#international">International Certificates</a></li><li><a href="/courses#ict">ICT &amp; Computer Skills</a></li></ul></div>
        <div><h4>Students</h4><ul><li><a href="/apply">Apply online</a></li><li><a href="/track">Track your application</a></li><li><a href="/verify">Verify a certificate</a></li></ul><a className="btn" href="/login">Staff login</a></div>
      </div>
      <div className="legal"><div className="wrap">© 2026 | All Rights Reserved | Powered by <b>Timtom Group</b></div></div>
    </footer>
  </div>);
}
