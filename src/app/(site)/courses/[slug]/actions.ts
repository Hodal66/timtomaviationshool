"use server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { readUtm, record } from "@/lib/track";

export type EnquiryState = { ok: boolean; error?: string } | null;

/** Enquiry from a course page or the contact page. Becomes a lead (ADM-01) with its campaign source. */
export async function enquire(_prev: EnquiryState, fd: FormData): Promise<EnquiryState> {
  const name = String(fd.get("name") ?? "").trim().slice(0, 120), contact = String(fd.get("contact") ?? "").trim().slice(0, 120);
  if (!name) return { ok: false, error: "Enter your name." };
  const isEmail = contact.includes("@");
  if (!contact || (isEmail ? !/^\S+@\S+\.\S+$/.test(contact) : contact.replace(/\D/g, "").length < 9)) return { ok: false, error: "Enter a valid phone number or email address." };
  const utm = readUtm((await cookies()).get("tas_utm")?.value);
  const pid = String(fd.get("programmeId") ?? "");
  const programme = pid ? await db.programme.findUnique({ where: { id: pid }, select: { id: true, slug: true } }) : null;
  await db.lead.create({ data: { name, email: isEmail ? contact : null, phone: isEmail ? null : contact, message: String(fd.get("message") ?? "").slice(0, 1000) || null,
    programmeId: programme?.id ?? null, source: utm?.utmSource ?? (programme ? "Website course page" : "Website contact page"), utmSource: utm?.utmSource ?? null, utmMedium: utm?.utmMedium ?? null, utmCampaign: utm?.utmCampaign ?? null } });
  await record({ type: "ENQUIRY", path: programme ? `/courses/${programme.slug}` : "/contact", programmeId: programme?.id, utmSource: utm?.utmSource });
  return { ok: true };
}
