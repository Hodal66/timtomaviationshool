import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { unstable_cache } from "next/cache";
const cachedProgramme = unstable_cache((slug: string) => db.programme.findFirst({ where: { slug, status: "PUBLISHED" } }), ["programme-by-slug"], { revalidate: 60, tags: ["catalogue"] });
import { CourseView } from "@/components/CourseView";
export const dynamic = "force-dynamic"; // language comes from a cookie, so pages are rendered per request; database reads below are cached

const get = (slug: string) => cachedProgramme(slug);

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
