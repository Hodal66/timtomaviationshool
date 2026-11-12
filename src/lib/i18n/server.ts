import { cookies, headers } from "next/headers";
import { COOKIE, fromHeader, isLang, translate, type Dict, type Lang } from "./index";
import fr from "./fr"; import rw from "./rw"; import sw from "./sw";

const DICTS: Record<Lang, Dict> = { en: {}, fr, rw, sw };
export const dictFor = (l: Lang) => DICTS[l];
export async function getLang(): Promise<Lang> {
  const c = (await cookies()).get(COOKIE)?.value; if (isLang(c)) return c;
  return fromHeader((await headers()).get("accept-language"));
}
export type TFn = (text: string, vars?: Record<string, string | number>) => string;
export const makeT = (l: Lang): TFn => (text, vars) => translate(DICTS[l], text, vars);
export async function getT() { const lang = await getLang(); return { lang, t: makeT(lang) }; }
