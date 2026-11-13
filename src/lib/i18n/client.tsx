"use client";
import { createContext, useContext, useMemo } from "react";
import { translate, type Dict, type Lang } from "./index";

export const Ctx = createContext<{ lang: Lang; dict: Dict }>({ lang: "en", dict: {} });
export function I18nProvider({ lang, dict, children }: { lang: Lang; dict: Dict; children: React.ReactNode }) {
  const v = useMemo(() => ({ lang, dict }), [lang, dict]); return <Ctx.Provider value={v}>{children}</Ctx.Provider>;
}
export const useLang = () => useContext(Ctx).lang;
export function useT() { const { dict } = useContext(Ctx); return (text: string, vars?: Record<string, string | number>) => translate(dict, text, vars); }
