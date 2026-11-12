/** Four-language support. English text is the key: a missing translation simply shows the English. */
export const LANGS = [
  { code: "en", label: "English", short: "EN" }, { code: "rw", label: "Kinyarwanda", short: "RW" },
  { code: "sw", label: "Kiswahili", short: "SW" }, { code: "fr", label: "Français", short: "FR" },
] as const;
export type Lang = (typeof LANGS)[number]["code"];
export const isLang = (v: unknown): v is Lang => LANGS.some((l) => l.code === v);
export type Dict = Record<string, string>;
export const COOKIE = "tas_lang";

export function translate(dict: Dict | undefined, text: string, vars?: Record<string, string | number>) {
  let s = dict?.[text] ?? text;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}
/** Picks a language from an Accept-Language header, defaulting to English. */
export function fromHeader(h: string | null | undefined): Lang {
  for (const part of (h ?? "").split(",")) { const c = part.trim().slice(0, 2).toLowerCase(); if (c === "rw" || c === "fr" || c === "sw" || c === "en") return c; }
  return "en";
}
