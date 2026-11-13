import { db } from "./db";
import { unstable_cache } from "next/cache";
import { AREAS, areaLabel, areaOf } from "./areas";
import { photoFor } from "./images";
import type { CardCourse } from "@/components/CourseCard";

const num = (code: string) => Number(code.replace(/\D/g, "")) || 9999;

/** Published programmes only. This is the single read path for the public catalogue. */
/** Cached for a minute (and refreshed at once when staff change a course), because language is read per request and pages are rendered dynamically. */
export const getCatalogue = unstable_cache(loadCatalogue, ["catalogue-list"], { revalidate: 60, tags: ["catalogue"] });
async function loadCatalogue() {
  const rows = await db.programme.findMany({ where: { status: "PUBLISHED", slug: { not: null } },
    select: { id: true, slug: true, code: true, name: true, summary: true, durationMonths: true, heroImage: true, visualTheme: true, type: true } });
  rows.sort((a, b) => num(a.code) - num(b.code));
  const courses = rows.map((r) => ({ ...r, slug: r.slug!, areaId: areaOf(r), areaLabel: areaLabel(areaOf(r)) }));
  const areas = AREAS.map((a) => ({ id: a.id, label: a.label, count: courses.filter((c) => c.areaId === a.id).length })).filter((a) => a.count > 0);
  return { courses: courses as (CardCourse & { areaId: string })[], areas };
}

/** One programme per subject area first, preferring ones that have a real photograph. */
export function featured(courses: (CardCourse & { areaId: string })[], n = 6) {
  const seen = new Set<string>(), out: typeof courses = [];
  const ranked = [...courses].sort((a, b) => Number(!!photoFor(b)) - Number(!!photoFor(a)));
  for (const c of ranked) { if (out.length >= n) break; if (!seen.has(c.areaId)) { seen.add(c.areaId); out.push(c); } }
  return out;
}
