import { beforeAll, describe, expect, it } from "vitest";
import { db, uniquePhone } from "./db";
import { createApplication } from "@/lib/application";
import { upcomingIntakes } from "@/lib/intakes";
import { DOC_KINDS } from "@/lib/apply";

let branch: string, slug: string, feeSlug: string;
const start = () => upcomingIntakes(4)[0].key;
const data = (o: Record<string, string> = {}) => ({ course: slug, branch, session: "WEEKDAY", start: start(), fullName: "QA Applicant", phone: uniquePhone(), email: "", dob: "2002-02-02", educationLevel: "Other", institution: "QA School", completionYear: "2020", ...o });

beforeAll(async () => {
  branch = (await db.branch.findFirstOrThrow({ where: { code: "KGL" } })).id;
  slug = (await db.programme.findFirstOrThrow({ where: { status: "PUBLISHED", slug: "personnel-licensing" } })).slug!;
  const fee = await db.programme.findFirstOrThrow({ where: { status: "PUBLISHED", slug: "safety-management-system" } });
  await db.programme.update({ where: { id: fee.id }, data: { registrationFeeRwf: 25000 } }); feeSlug = fee.slug!;
});

describe("createApplication (ADM-02, ADM-04, ADM-10, FIN)", () => {
  it("creates an application with checklist, lead, event and queued WhatsApp message", async () => {
    const r = await createApplication(data({ email: "qa1@example.com" }), {});
    expect(r.ok).toBe(true); if (!r.ok) return;
    const a = await db.applicant.findUniqueOrThrow({ where: { reference: r.reference }, include: { documents: true, events: true, branch: true, intake: true } });
    expect(a.status).toBe("SUBMITTED"); expect(a.documents.map((d) => d.kind).sort()).toEqual([...DOC_KINDS].sort()); expect(a.documents.every((d) => d.status === "PENDING")).toBe(true);
    expect(a.events[0].message).toBe("Application submitted."); expect(a.branch.code).toBe("KGL"); expect(a.intake.label).toBe(upcomingIntakes(4)[0].label);
    expect(await db.lead.count({ where: { message: `Application ${r.reference}` } })).toBe(1);
    const n = await db.notification.findMany({ where: { applicantId: a.id } });
    expect(n.some((x) => x.channel === "WHATSAPP" && x.status === "QUEUED")).toBe(true);
    expect(n.find((x) => x.channel === "EMAIL")?.status).toBe("SKIPPED"); // no SMTP configured in tests
  });
  it("creates a registration invoice when the programme has a fee", async () => {
    const r = await createApplication(data({ course: feeSlug }), {}); expect(r.ok).toBe(true); if (!r.ok) return;
    const inv = await db.invoice.findMany({ where: { applicant: { reference: r.reference } } });
    expect(inv).toHaveLength(1); expect(inv[0].amountMinor).toBe(25000); expect(inv[0].status).toBe("PENDING");
  });
  it("does not create an invoice when no fee is set", async () => {
    const r = await createApplication(data(), {}); if (!r.ok) throw new Error(r.error);
    expect(await db.invoice.count({ where: { applicant: { reference: r.reference } } })).toBe(0);
  });
  it("links uploaded draft documents and marks them received", async () => {
    const d = await db.applicationDraft.create({ data: { token: "qa-token-" + Date.now(), data: {} } });
    await db.upload.create({ data: { kind: DOC_KINDS[0], filename: "id.jpg", mime: "image/jpeg", size: 3, data: Buffer.from([1, 2, 3]), draftId: d.id } });
    const r = await createApplication(data(), { draftId: d.id }); if (!r.ok) throw new Error(r.error);
    const a = await db.applicant.findUniqueOrThrow({ where: { reference: r.reference }, include: { documents: true, uploads: true } });
    expect(a.uploads).toHaveLength(1); expect(a.documents.find((x) => x.kind === DOC_KINDS[0])?.status).toBe("RECEIVED"); expect(a.documents.filter((x) => x.status === "PENDING")).toHaveLength(2);
    expect(await db.applicationDraft.count({ where: { id: d.id } })).toBe(0);
  });
  it("refuses a duplicate for the same programme but allows another programme", async () => {
    const phone = uniquePhone(); expect((await createApplication(data({ phone }), {})).ok).toBe(true);
    const dup = await createApplication(data({ phone, fullName: "Again" }), {}); expect(dup.ok).toBe(false); if (!dup.ok) expect(dup.error).toMatch(/already exists/);
    expect((await createApplication(data({ phone, course: feeSlug }), {})).ok).toBe(true);
  });
  it("lets a rejected applicant apply again", async () => {
    const phone = uniquePhone(); const r = await createApplication(data({ phone }), {}); if (!r.ok) throw new Error(r.error);
    await db.applicant.update({ where: { reference: r.reference }, data: { status: "REJECTED" } }); expect((await createApplication(data({ phone }), {})).ok).toBe(true);
  });
  it("validates every server-side input", async () => {
    expect((await createApplication(data({ start: "1999-01" }), {})).ok).toBe(false);
    expect((await createApplication(data({ branch: "nope" }), {})).ok).toBe(false);
    expect((await createApplication(data({ course: "does-not-exist" }), {})).ok).toBe(false);
    expect((await createApplication(data({ session: "NIGHT" }), {})).ok).toBe(false);
    expect((await createApplication(data({ fullName: "" }), {})).ok).toBe(false);
    expect((await createApplication(data({ dob: new Date(Date.now() - 15 * 365.25 * 864e5).toISOString().slice(0, 10) }), {})).ok).toBe(false); // minor without guardian
  });
  it("refuses unpublished and archived programmes", async () => {
    const p = await db.programme.findFirstOrThrow({ where: { slug: "dangerous-goods" } });
    await db.programme.update({ where: { id: p.id }, data: { status: "ARCHIVED" } });
    const r = await createApplication(data({ course: "dangerous-goods" }), {}); expect(r.ok).toBe(false);
    await db.programme.update({ where: { id: p.id }, data: { status: "PUBLISHED" } });
  });
  it("accepts a minor with a guardian and stores guardian details", async () => {
    const dob = new Date(Date.now() - 15 * 365.25 * 864e5).toISOString().slice(0, 10);
    const r = await createApplication(data({ dob, guardianName: "Parent", guardianPhone: "+250788000111" }), {}); if (!r.ok) throw new Error(r.error);
    const a = await db.applicant.findUniqueOrThrow({ where: { reference: r.reference } }); expect(a.guardianName).toBe("Parent");
  });
  it("is safe when 25 applicants submit at the same moment (no lost or duplicated rows)", async () => {
    const phones = Array.from({ length: 25 }, () => uniquePhone()); const res = await Promise.all(phones.map((phone) => createApplication(data({ phone }), {})));
    expect(res.every((x) => x.ok)).toBe(true); expect(new Set(res.map((x) => x.ok && x.reference)).size).toBe(25);
    expect(await db.applicant.count({ where: { phone: { in: phones } } })).toBe(25);
  });
  it("stores source attribution from the UTM cookie (CMS-03)", async () => {
    const r = await createApplication(data(), { cookieUtm: encodeURIComponent(JSON.stringify({ utmSource: "facebook", utmMedium: "social", utmCampaign: "qa" })) }); if (!r.ok) throw new Error(r.error);
    const a = await db.applicant.findUniqueOrThrow({ where: { reference: r.reference } }); expect([a.utmSource, a.utmMedium, a.utmCampaign, a.leadSource]).toEqual(["facebook", "social", "qa", "facebook"]);
    expect((await db.lead.findFirstOrThrow({ where: { message: `Application ${r.reference}` } })).utmSource).toBe("facebook");
  });
});
