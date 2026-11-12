import type { ThemeKey } from "./catalogue";

/**
 * Course image configuration.
 *  1. A programme's own image (uploaded in Admin > Courses, or a path under /images) always wins.
 *  2. Otherwise a subject-area photo below is used, if one is configured.
 *  3. Otherwise the course shows designed aviation artwork (an illustration, not a photograph).
 * To add licensed photography for a subject, drop the file in public/images/areas and list it here.
 * No component changes are needed.
 */
export type Photo = { src: string; alt: string };

const CLASSROOM: Photo[] = [
  { src: "/images/site/hero-a.jpg", alt: "Students training at computer terminals with headsets" },
  { src: "/images/site/hero-b.jpg", alt: "Trainers and students in a Timtom computer classroom" },
  { src: "/images/site/hero-c.jpg", alt: "Students practising at reservation terminals" },
  { src: "/images/site/hero-d.jpg", alt: "A trainer and students in a Timtom training room" },
];

export const AREA_PHOTOS: Partial<Record<ThemeKey, Photo[]>> = {
  ict: CLASSROOM,
  ticketing: [CLASSROOM[2]],
};

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export function photoFor(p: { heroImage: string | null; visualTheme: string; code: string; name: string }): Photo | null {
  if (p.heroImage) return { src: p.heroImage, alt: `${p.name}` };
  const list = AREA_PHOTOS[p.visualTheme as ThemeKey];
  return list?.length ? list[hash(p.code) % list.length] : null;
}
