"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string };
const active = (path: string, href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/") || (href === "/how-to-apply" && (path === "/track" || path === "/apply")));

export function SiteNav({ items }: { items: Item[] }) {
  const path = usePathname();
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);
  const first = useRef<HTMLAnchorElement>(null);
  useEffect(() => { const f = () => setSolid(scrollY > 12); f(); addEventListener("scroll", f, { passive: true }); return () => removeEventListener("scroll", f); }, []);
  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    if (open) first.current?.focus();
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    addEventListener("keydown", k); return () => { removeEventListener("keydown", k); document.body.style.overflow = ""; };
  }, [open]);
  return (<>
    <header className={`hd${solid || open ? " solid" : ""}`}><div className="wrap">
      <a href="/" className="logo" aria-label="Timtom Aviation School, home"><img src="/images/site/logo.png" alt="Timtom Aviation School" width={156} height={54} /></a>
      <nav aria-label="Main"><ul>{items.map((i) => <li key={i.href}><a href={i.href} aria-current={active(path, i.href) ? "page" : undefined}>{i.label}</a></li>)}</ul></nav>
      <a className="btn cta sm" href="/apply">Apply Now</a>
      <button className="burger" aria-expanded={open} aria-controls="drawer" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen(!open)}><i /></button>
    </div></header>
    <div id="drawer" className={`drawer${open ? " open" : ""}`} hidden={!open} role="dialog" aria-modal="true" aria-label="Menu">
      {items.map((i, n) => <a key={i.href} ref={n === 0 ? first : undefined} className="l" href={i.href} aria-current={active(path, i.href) ? "page" : undefined}>{i.label}</a>)}
      <a className="btn cta" href="/apply">Apply Now</a>
    </div>
  </>);
}
