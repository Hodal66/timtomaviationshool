"use client";
import { useEffect, useRef } from "react";

/** Light, calm particle network. Pauses off-screen and when the tab is hidden; a single still frame for reduced motion. */
export function Particles({ color = "11,77,162", density = 16000, className }: { color?: string; density?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0, h = 0, raf = 0, running = false, visible = true;
    type P = { x: number; y: number; vx: number; vy: number; r: number };
    let pts: P[] = [];
    const build = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2), r = cv.getBoundingClientRect();
      w = r.width; h = r.height; cv.width = w * dpr; cv.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.max(14, Math.min(w < 700 ? 28 : 70, Math.round((w * h) / density)));
      pts = Array.from({ length: n }, () => ({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - .5) * .22, vy: (Math.random() - .5) * .22, r: Math.random() * 1.6 + .7 }));
    };
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const L = 130;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        for (let j = i + 1; j < pts.length; j++) { const b = pts[j], dx = a.x - b.x, dy = a.y - b.y, d = dx * dx + dy * dy; if (d < L * L) { ctx.strokeStyle = `rgba(${color},${(1 - Math.sqrt(d) / L) * .18})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); } }
        ctx.fillStyle = `rgba(${color},.38)`; ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, 6.283); ctx.fill();
      }
    };
    const tick = () => {
      for (const p of pts) { p.x += p.vx; p.y += p.vy; if (p.x < 0 || p.x > w) p.vx *= -1; if (p.y < 0 || p.y > h) p.vy *= -1; }
      draw(); raf = running ? requestAnimationFrame(tick) : 0;
    };
    const start = () => { if (still || running || !visible || document.hidden) return; running = true; raf = requestAnimationFrame(tick); };
    const stop = () => { running = false; cancelAnimationFrame(raf); };
    build(); draw();
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop(); }, { threshold: 0 });
    io.observe(cv);
    const vis = () => (document.hidden ? stop() : start());
    let t: ReturnType<typeof setTimeout>; const rs = () => { clearTimeout(t); t = setTimeout(() => { build(); draw(); }, 200); };
    document.addEventListener("visibilitychange", vis); addEventListener("resize", rs); start();
    return () => { stop(); io.disconnect(); document.removeEventListener("visibilitychange", vis); removeEventListener("resize", rs); clearTimeout(t); };
  }, [color, density]);
  return <canvas ref={ref} className={`pt ${className ?? ""}`} aria-hidden="true" />;
}
