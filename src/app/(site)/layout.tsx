import "../site.css";
import { SiteNav } from "@/components/SiteNav";
import { NAV, SITE } from "@/lib/site";

export default function Site({ children }: { children: React.ReactNode }) {
  return (<div className="site">
    <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
    <a className="skip" href="#main">Skip to content</a>
    <SiteNav items={NAV} />
    <main id="main">{children}</main>
    <footer className="ft2">
      <div className="wrap cols">
        <div><img className="fl" src="/images/site/logo.png" alt="Timtom Aviation School" width={150} height={52} loading="lazy" />
          <p style={{ maxWidth: "36ch" }}>{SITE.mission}</p>
          {SITE.socials.length > 0 && <div className="soc" aria-label="Social media">{SITE.socials.map(([n, u]) => <a key={n} href={u} target="_blank" rel="noopener noreferrer">{n}</a>)}</div>}</div>
        <div><h4>Explore</h4><ul>{NAV.map((n) => <li key={n.href}><a href={n.href}>{n.label}</a></li>)}</ul></div>
        <div><h4>Students</h4><ul><li><a href="/courses">Discover courses</a></li><li><a href="/apply">Apply online</a></li><li><a href="/track">Track your application</a></li><li><a href="/verify">Verify a certificate</a></li><li><a href="/careers">Teach with us</a></li></ul></div>
        <div><h4>Contact</h4><address>
          <a href={`tel:${SITE.phone}`}>{SITE.phoneDisplay}</a><a href={`mailto:${SITE.email}`}>{SITE.email}</a><span>{SITE.address}</span>
          {SITE.whatsapp && <a href={`https://wa.me/${SITE.whatsapp}`}>WhatsApp admissions</a>}</address></div>
      </div>
      <div className="wrap legal"><span>© {new Date().getFullYear()} {SITE.name}. All rights reserved.</span><a href="/login">Staff sign in</a></div>
    </footer>
  </div>);
}
