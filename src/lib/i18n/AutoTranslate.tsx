"use client";
import { useEffect } from "react";
import { useLang, useT } from "./client";
import { useContext } from "react";
import { Ctx } from "./client";

/**
 * Translates page text that is not wrapped in t(): text nodes and common attributes are looked up in the
 * dictionary (English text is the key; keys with {name} placeholders match patterns such as "Step {a} of {b}").
 * Anything without a translation stays in English. Runs only for non-English languages.
 */
const ATTRS = ["placeholder", "title", "aria-label", "alt"];
export function AutoTranslate() {
  const { lang, dict } = useContext(Ctx);
  useEffect(() => {
    if (lang === "en") return;
    const norm = (s: string) => s.replace(/\s+/g, " ").trim();
    const exact = new Map<string, string>(); const pats: { re: RegExp; names: string[]; to: string }[] = [];
    for (const [k, v] of Object.entries(dict)) {
      if (!k.includes("{")) { exact.set(norm(k), v); continue; }
      const names: string[] = []; const src = norm(k).replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/\{(\w+)\}/g, (_, n) => { names.push(n); return "(.+?)"; });
      pats.push({ re: new RegExp("^" + src + "$"), names, to: v });
    }
    const tr = (raw: string): string | null => {
      const k = norm(raw); if (!k || k.length > 400) return null;
      let v = exact.get(k);
      if (!v) for (const p of pats) { const m = k.match(p.re); if (m) { v = p.to.replace(/\{(\w+)\}/g, (_, n) => m[p.names.indexOf(n) + 1] ?? ""); break; } }
      if (!v || v === k) return null;
      const lead = raw.match(/^\s*/)![0], trail = raw.match(/\s*$/)![0]; return lead + v + trail;
    };
    const skip = (e: Element | null) => !!e?.closest("script,style,textarea,code,pre,[data-notranslate]");
    const run = (root: Node) => {
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); const nodes: Text[] = []; for (let n = w.nextNode(); n; n = w.nextNode()) nodes.push(n as Text);
      for (const n of nodes) { if (skip(n.parentElement)) continue; const v = tr(n.nodeValue ?? ""); if (v) n.nodeValue = v; }
      const els = root.nodeType === 1 ? [root as Element, ...(root as Element).querySelectorAll("*")] : [];
      for (const e of els) { if (skip(e)) continue; for (const a of ATTRS) { const cur = e.getAttribute(a); if (cur) { const v = tr(cur); if (v) e.setAttribute(a, v); } } if (e instanceof HTMLInputElement && (e.type === "submit" || e.type === "button") && e.value) { const v = tr(e.value); if (v) e.value = v; } }
    };
    const title = () => { const v = tr(document.title); if (v) document.title = v; };
    run(document.body); title();
    let q = 0; const pending = new Set<Node>();
    const mo = new MutationObserver((ms) => {
      for (const m of ms) { if (m.type === "childList") m.addedNodes.forEach((n) => pending.add(n.nodeType === 3 ? n.parentNode! : n)); else if (m.type === "characterData") pending.add(m.target.parentNode!); else if (m.type === "attributes") pending.add(m.target); }
      if (q) return;
      q = requestAnimationFrame(() => { q = 0; mo.disconnect(); const todo = [...pending]; pending.clear(); for (const n of todo) if (n && n.isConnected && (n.nodeType === 1)) run(n); title(); mo.observe(document.body, OPTS); });
    });
    const OPTS: MutationObserverInit = { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS };
    mo.observe(document.body, OPTS); return () => { mo.disconnect(); if (q) cancelAnimationFrame(q); };
  }, [lang, dict]);
  void useLang; void useT; return null;
}
