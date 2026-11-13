"use client";
import { useEffect, useState } from "react";
import { COOKIE, fromHeader, isLang, type Dict, type Lang } from "./index";
import { I18nProvider } from "./client";
import { AutoTranslate } from "./AutoTranslate";

const LOAD: Record<string, () => Promise<{ default: Dict }>> = { fr: () => import("./fr"), rw: () => import("./rw"), sw: () => import("./sw") };
/** Public pages are static HTML. The browser picks the language (cookie, else the browser setting) and loads that dictionary. */
export function ClientRoot({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ lang: Lang; dict: Dict }>({ lang: "en", dict: {} });
  useEffect(() => {
    const c = document.cookie.match(new RegExp("(?:^|; )" + COOKIE + "=([^;]*)"))?.[1];
    const lang: Lang = isLang(c) ? c : fromHeader(navigator.language);
    document.documentElement.lang = lang;
    if (lang === "en") { document.documentElement.classList.remove("i18n-pending"); return; }
    let live = true; LOAD[lang]().then((m) => { if (live) { setState({ lang, dict: m.default }); requestAnimationFrame(() => requestAnimationFrame(() => document.documentElement.classList.remove("i18n-pending"))); } });
    const safety = setTimeout(() => document.documentElement.classList.remove("i18n-pending"), 2500);
    return () => { live = false; clearTimeout(safety); };
  }, []);
  return <I18nProvider lang={state.lang} dict={state.dict}><AutoTranslate />{children}</I18nProvider>;
}
