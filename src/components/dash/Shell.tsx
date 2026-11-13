"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Icon } from "./icons";
import { ThemeMenu, LangMenu } from "./ThemeLang";
import { useT } from "@/lib/i18n/client";

export type NavItem = { href: string; label: string; icon: string };
export function Shell({ brand, nav, user, logout, children }: { brand: string; nav: NavItem[]; user: { name: string; sub: string }; logout: () => void | Promise<void>; children: React.ReactNode }) {
  const t = useT(); const path = usePathname(); const [collapsed, setCollapsed] = useState(false); const [open, setOpen] = useState(false); const [top, setTop] = useState(false);
  useEffect(() => { try { setCollapsed(localStorage.getItem("tas_side") === "1"); } catch { /* ignore */ } }, []);
  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => { const f = () => setTop(scrollY > 400); addEventListener("scroll", f, { passive: true }); const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false); addEventListener("keydown", k); return () => { removeEventListener("scroll", f); removeEventListener("keydown", k); }; }, []);
  const toggle = () => { const n = !collapsed; setCollapsed(n); try { localStorage.setItem("tas_side", n ? "1" : "0"); } catch { /* ignore */ } };
  const cur = nav.find((n) => path === n.href || path.startsWith(n.href + "/"));
  const initials = user.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "U";
  return (<div className="ds" data-collapsed={collapsed} data-open={open}>
    <aside className="ds-side" aria-label={t("Modules")}>
      <a className="ds-brand" href="/"><i>✈</i><span>{brand}</span></a>
      <nav className="ds-nav">{nav.map((n) => <a key={n.href} href={n.href} aria-current={cur?.href === n.href ? "page" : undefined} title={n.label}><Icon n={n.icon} /><span>{n.label}</span></a>)}</nav>
      <div className="ds-foot"><button className="hide-m" onClick={toggle} aria-label={collapsed ? t("Expand menu") : t("Collapse menu")}><Icon n="panel" size={18} /><span>{collapsed ? t("Expand menu") : t("Collapse menu")}</span></button>
        <form action={logout}><button type="submit"><Icon n="logout" size={18} /><span>{t("Sign out")}</span></button></form></div>
    </aside>
    <div className="ds-back" onClick={() => setOpen(false)} />
    <div className="ds-main">
      <header className="ds-top"><button className="ico ds-burger" aria-label={t("Open menu")} aria-expanded={open} onClick={() => setOpen(!open)}><Icon n={open ? "x" : "menu"} /></button>
        <div className="grow">{cur?.label ?? brand}</div><LangMenu /><ThemeMenu />
        <div className="chip hide-m"><i aria-hidden>{initials}</i><span style={{ lineHeight: 1.2 }}><b style={{ display: "block", fontSize: 13 }}>{user.name}</b><small style={{ color: "var(--muted)" }}>{user.sub}</small></span></div></header>
      <main className="ds-content" id="main">{children}</main>
    </div>
    {top && <button className="ico totop" aria-label={t("Back to top")} onClick={() => scrollTo({ top: 0, behavior: "smooth" })}><Icon n="up" /></button>}
  </div>);
}
