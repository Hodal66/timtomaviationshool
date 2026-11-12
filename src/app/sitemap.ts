import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { SITE } from "@/lib/site";
export const revalidate = 300;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const courses = await db.programme.findMany({ where: { status: "PUBLISHED", slug: { not: null } }, select: { slug: true, updatedAt: true } }).catch(() => []);
  const base = ["", "/about", "/courses", "/how-to-apply", "/contact"].map((p) => ({ url: SITE.url + p, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.7 }));
  return [...base, ...courses.map((c) => ({ url: `${SITE.url}/courses/${c.slug}`, lastModified: c.updatedAt, changeFrequency: "weekly" as const, priority: 0.8 }))];
}
