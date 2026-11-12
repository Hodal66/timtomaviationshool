export default function Site({ children }: { children: React.ReactNode }) {
  const wa = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;
  return (<div className="site">
    <header className="sh"><div className="wrap">
      <a href="/" className="logo"><i>TAS</i>Timtom Aviation School</a>
      <nav aria-label="Main"><a href="/courses">Courses</a><a href="/track">Track application</a><a href="/verify">Verify a certificate</a><a href="/login">Staff</a></nav>
      <a className="btn" href="/apply">Apply now</a>
    </div></header>
    <div style={{ flex: 1 }}>{children}</div>
    <footer className="sf"><div className="wrap">
      <b>Timtom Aviation School</b> · Kigali · Bugesera–Nyamata · Goma<br />
      {wa ? <>Admissions on WhatsApp: <a href={`https://wa.me/${wa.replace(/\D/g, "")}`}>chat with admissions</a></> : "Admissions contact details are published by the School."}
    </div></footer>
  </div>);
}
