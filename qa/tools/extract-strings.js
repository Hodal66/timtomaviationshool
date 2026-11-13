// Collects every visible English string (text nodes + placeholder/title/aria-label/alt) from the running site, for the translation dictionaries.
const { chromium } = require("/home/user/timtomaviationshool/node_modules/playwright");
const fs = require("fs");
(async () => {
  const b = await chromium.launch(); const seen = new Map();
  const grab = async (p, tag) => { const items = await p.evaluate(() => { const out = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) { const e = n.parentElement; if (!e || e.closest("script,style,[data-notranslate]")) continue; const t = n.nodeValue.replace(/\s+/g, " ").trim(); if (t) out.push(t); }
    document.querySelectorAll("[placeholder],[title],[aria-label],[alt]").forEach((e) => { for (const a of ["placeholder", "title", "aria-label", "alt"]) { const v = e.getAttribute(a); if (v) out.push(v.replace(/\s+/g, " ").trim()); } }); out.push(document.title); return out; });
    for (const t of items) if (!seen.has(t)) seen.set(t, tag); };
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, baseURL: "http://localhost:3100", extraHTTPHeaders: { "accept-language": "en" } }); const p = await ctx.newPage();
  for (const u of ["/", "/about", "/courses", "/courses/personnel-licensing", "/how-to-apply", "/contact", "/track", "/verify", "/gallery", "/start", "/login"]) { await p.goto(u, { waitUntil: "networkidle" }); await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); } }); await grab(p, u); }
  // the wizard steps
  await p.goto("/apply?course=personnel-licensing"); await p.waitForTimeout(500);
  fs.writeFileSync("qa/i18n-strings.json", JSON.stringify([...seen].map(([s, w]) => ({ s, w })), null, 0)); console.log(seen.size, "strings");
  await b.close();
})();
