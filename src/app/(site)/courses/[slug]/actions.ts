"use server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { record, readUtm } from "@/lib/track";

export async function enquire(fd: FormData) {
  const name = String(fd.get("name") ?? "").trim().slice(0, 120), contact = String(fd.get("contact") ?? "").trim().slice(0, 120);
  const slug = String(fd.get("slug") ?? ""), programmeId = String(fd.get("programmeId") ?? "");
  if (!name || !contact) redirect(`/courses/${slug}`);
  const utm = readUtm((await cookies()).get("tas_utm")?.value);
  const isEmail = contact.includes("@");
  await db.lead.create({ data: { name, email: isEmail ? contact : null, phone: isEmail ? null : contact, message: String(fd.get("message") ?? "").slice(0, 1000) || null,
    programmeId: (await db.programme.findUnique({ where: { id: programmeId }, select: { id: true } }))?.id ?? null, source: utm?.utmSource ?? "Website course page",
    utmSource: utm?.utmSource ?? null, utmMedium: utm?.utmMedium ?? null, utmCampaign: utm?.utmCampaign ?? null } });
  await record({ type: "ENQUIRY", path: `/courses/${slug}`, programmeId, utmSource: utm?.utmSource });
  redirect(`/courses/${slug}?sent=1`);
}
