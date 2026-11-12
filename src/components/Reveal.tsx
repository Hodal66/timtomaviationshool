"use client";
import { useEffect, useRef } from "react";

/** Fade and slide-up on entering the viewport. Content stays visible if JavaScript is unavailable. */
export function Reveal({ children, delay = 0, className = "", as: Tag = "div" }: { children: React.ReactNode; delay?: number; className?: string; as?: "div" | "section" | "li" | "article" }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) { el.classList.add("in"); return; }
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { el.classList.add("in"); io.disconnect(); } }), { rootMargin: "0px 0px -8% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const T = Tag as React.ElementType;
  return <T ref={ref} className={`rv ${className}`} style={{ ["--d" as string]: `${delay}ms` }}>{children}</T>;
}
