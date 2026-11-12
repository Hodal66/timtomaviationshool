import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { CourseView } from "@/components/CourseView";
export const revalidate = 60;
export const dynamicParams = true;
/** No pages are built ahead of time; each course is rendered on first visit, then cached and refreshed every minute (and at once when staff publish or edit). */
export function generateStaticParams() { return []; }

const get = (slug: string) => db.programme.findFirst({ where: { slug, status: "PUBLISHED" } });

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await get((await params).slug);
  if (!p) return { title: "Course not found" };
  const desc = (p.summary ?? p.description ?? "").slice(0, 160);
  return { title: `${p.name} | Timtom Aviation School`, description: desc, alternates: { canonical: `/courses/${p.slug}` },
    openGraph: { title: p.name, description: desc, type: "website", images: p.heroImage ? [p.heroImage] : ["/images/site/hero-a.jpg"] } };
}

export default async function Course({ params }: { params: Promise<{ slug: string }> }) {
  const p = await get((await params).slug);
  if (!p) notFound();
  return <CourseView p={p} />;
}
