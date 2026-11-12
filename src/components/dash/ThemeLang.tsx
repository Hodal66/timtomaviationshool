"use client";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./icons";
import { LANGS } from "@/lib/i18n";
import { useLang, useT } from "@/lib/i18n/client";

function useOutside(close: () => void) {
  const r = useRef<HTMLDivElement>(null);
  useEffect(() => { const f = (e: MouseEvent) => { if (r.current && !r.current.contains(e.target as Node)) close(); }; const k = (e: KeyboardEvent) => e.key === "Escape" && close(); document.addEventListener("mousedown", f); document.addEventListener("keydown", k); return () => { document.removeEventListener("mousedown", f); document.removeEventListener("keydown", k); }; }, [close]);
  return r;
}
type Mode = "light" | "dark" | "system";
export function ThemeMenu() {
  const t = useT(); const [open, setOpen] = useState(false); const [mode, setMode] = useState<Mode>("system"); const ref = useOutside(() => setOpen(false));
  useEffect(() => { try { const s = localStorage.getItem("tas_theme"); if (s === "light" || s === "dark") setMode(s); } catch { /* storage blocked */ } }, []);
  const apply = (m: Mode) => { setMode(m); setOpen(false); try { if (m === "system") localStorage.removeItem("tas_theme"); else localStorage.setItem("tas_theme", m); } catch { /* ignore */ } if (m === "system") document.documentElement.removeAttribute("data-theme"); else document.documentElement.dataset.theme = m; };
  const dark = mode === "dark" || (mode === "system" && typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches);
  return (<div className="menu" ref={ref}><button className="ico" aria-haspopup="menu" aria-expanded={open} aria-label={t("Colour theme")} onClick={() => setOpen(!open)}><Icon n={dark ? "moon" : "sun"} /></button>
    {open && <div role="menu">{(["light", "dark", "system"] as Mode[]).map((m) => <button key={m} role="menuitemradio" aria-checked={mode === m} onClick={() => apply(m)}>{m === "light" ? t("Light") : m === "dark" ? t("Dark") : t("Automatic")}{mode === m && "✓"}</button>)}</div>}</div>);
}
export function LangMenu({ light }: { light?: boolean }) {
  const lang = useLang(); const t = useT(); const [open, setOpen] = useState(false); const ref = useOutside(() => setOpen(false));
  const pick = (c: string) => { document.cookie = `tas_lang=${c}; path=/; max-age=31536000; samesite=lax`; location.reload(); };
  return (<div className="menu" ref={ref}><button className={"ico" + (light ? " lt" : "")} style={{ width: "auto", padding: "0 10px", gap: 6, display: "flex", alignItems: "center" }} aria-haspopup="menu" aria-expanded={open} aria-label={t("Language")} onClick={() => setOpen(!open)}><Icon n="globe" size={18} /><b style={{ fontSize: 12 }}>{lang.toUpperCase()}</b></button>
    {open && <div role="menu">{LANGS.map((l) => <button key={l.code} role="menuitemradio" lang={l.code} aria-checked={lang === l.code} onClick={() => pick(l.code)}>{l.label}{lang === l.code && "✓"}</button>)}</div>}</div>);
}
