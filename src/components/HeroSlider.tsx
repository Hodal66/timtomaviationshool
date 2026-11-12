"use client";
import { useEffect, useState } from "react";

const SLIDES = ["/images/site/hero-a.jpg", "/images/site/hero-b.jpg", "/images/site/hero-c.jpg", "/images/site/hero-d.jpg"];

export function HeroSlider({ enrollHref }: { enrollHref: string }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || (typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches)) return;
    const t = setInterval(() => setI((x) => (x + 1) % SLIDES.length), 6000);
    return () => clearInterval(t);
  }, [paused]);
  const go = (n: number) => setI((n + SLIDES.length) % SLIDES.length);
  return (<section className="slider" aria-roledescription="carousel" aria-label="Timtom Aviation School" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
    {SLIDES.map((src, n) => (<div key={src} className={`slide${n === i ? " on" : ""}`} aria-hidden={n !== i}><img src={src} alt="" loading={n === 0 ? "eager" : "lazy"} /></div>))}
    <div className="card"><h2>🎓 Training in Aviation Courses</h2><p>Empowering your aviation career through quality education.</p><a className="btn" href={enrollHref}>Enroll Today</a></div>
    <button className="nav prev" aria-label="Previous slide" onClick={() => go(i - 1)}>‹</button>
    <button className="nav next" aria-label="Next slide" onClick={() => go(i + 1)}>›</button>
    <div className="dots">{SLIDES.map((_, n) => <button key={n} aria-label={`Slide ${n + 1}`} aria-current={n === i} onClick={() => go(n)} />)}</div>
  </section>);
}
