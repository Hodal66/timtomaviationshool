import Image from "next/image";
import { photoFor } from "@/lib/images";
import { themeOf } from "@/lib/catalogue";
import { Motif } from "./Motif";

export type CardCourse = { id: string; slug: string; code: string; name: string; summary: string | null; durationMonths: number | null; heroImage: string | null; visualTheme: string; areaLabel: string };

/** One image component for every programme: own image, then area photo, then designed artwork. */
export function CourseImage({ c, sizes, priority }: { c: Pick<CardCourse, "heroImage" | "visualTheme" | "code" | "name">; sizes: string; priority?: boolean }) {
  const photo = photoFor(c);
  if (photo) {
    return photo.src.startsWith("/api/") ? <img src={photo.src} alt="" loading={priority ? "eager" : "lazy"} decoding="async" />
      : <Image src={photo.src} alt="" fill sizes={sizes} priority={priority} style={{ objectFit: "cover" }} />;
  }
  const t = themeOf(c.visualTheme);
  return <span className="art-fill" style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: `radial-gradient(120% 90% at 20% 0%, ${t.line} 0%, ${t.dark} 72%)` }}><span style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(115deg,rgba(255,255,255,.05) 0 1px,transparent 1px 22px)" }} /><span style={{ position: "relative", width: "58%" }}><Motif theme={c.visualTheme} /></span></span>;
}

export function CourseCard({ c, priority }: { c: CardCourse; priority?: boolean }) {
  return (<article className="cc">
    <div className="ph"><CourseImage c={c} sizes="(max-width:700px) 92vw,(max-width:1100px) 45vw,310px" priority={priority} /><span className="tagc">{c.areaLabel}</span></div>
    <div className="bd">
      <h3><a href={`/courses/${c.slug}`}>{c.name}</a></h3>
      {c.summary && <p>{c.summary}</p>}
      <div className="ft">{c.durationMonths ? <span className="dur">{c.durationMonths} months</span> : <span />}<span className="vp">View Programme <span aria-hidden="true">→</span></span></div>
    </div>
  </article>);
}
