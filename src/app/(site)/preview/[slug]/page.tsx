import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { CourseView } from "@/components/CourseView";
export const dynamic = "force-dynamic";
export const metadata = { title: "Preview", robots: { index: false, follow: false } };

/** Staff preview of any programme, whatever its status. */
export default async function Preview({ params }: { params: Promise<{ slug: string }> }) {
  if (!(await getSession())) redirect("/login");
  const p = await db.programme.findUnique({ where: { slug: (await params).slug } });
  if (!p) notFound();
  return <CourseView p={p} preview />;
}
