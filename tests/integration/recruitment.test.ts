import { describe, it, expect } from "vitest";
import { db } from "./db";
import type { Actor } from "@/lib/lecturers";
import { saveVacancy, setVacancyStatus, openVacancies, applyForJob, moveJobApp, makeOffer, offerLetter, hire, tickOnboarding, onboardingDone, ONBOARDING } from "@/lib/recruitment";
import { describeDoc } from "@/lib/student-docs";

let n = 0; const u = () => `${Date.now().toString(36)}${n++}`;
const acad: Actor = { uid: "acad-" + u(), name: "Academic Head", role: "ACADEMIC" };
const PDF = new TextEncoder().encode("%PDF-1.4\n%fake cv\n"), DOCX = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]);
const cv = (bytes = PDF, type = "application/pdf") => ({ name: "cv.pdf", type, bytes });
const future = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
async function vacancy(extra: Record<string, string> = {}) { const r = await saveVacancy(acad, { title: "Lecturer Cargo " + u(), description: "Teach air cargo operations to evening classes.", subjects: "Cargo, Dangerous goods", requirements: "Five years in cargo\nIATA DGR certificate", closesOn: future, ...extra }); if (typeof r === "string") throw new Error(r); return db.vacancy.findUniqueOrThrow({ where: { id: r.id } }); }

describe("lecturer recruitment (LEC-07, LEC-08, LEC-10)", () => {
  it("vacancies: managers only, validated, start as drafts and appear on the website only when published and open (LEC-07)", async () => {
    expect(await saveVacancy({ ...acad, role: "FINANCE" }, { title: "X" })).toMatch(/Not allowed/); expect(await saveVacancy(acad, { title: "Lecturer", description: "short" })).toMatch(/20 characters/); expect(await saveVacancy(acad, { title: "Lecturer", description: "x".repeat(30), closesOn: "2020-01-01" })).toMatch(/closing date/);
    const v = await vacancy(); expect([v.status, v.subjects, v.requirements]).toEqual(["DRAFT", ["Cargo", "Dangerous goods"], ["Five years in cargo", "IATA DGR certificate"]]); expect((await openVacancies()).some((x) => x.id === v.id)).toBe(false);
    expect(await setVacancyStatus(acad, v.id, "PUBLISHED")).toBeNull(); expect((await openVacancies()).some((x) => x.id === v.id)).toBe(true);
    await db.vacancy.update({ where: { id: v.id }, data: { closesOn: new Date("2020-01-01") } }); expect((await openVacancies()).some((x) => x.id === v.id)).toBe(false); expect(await setVacancyStatus(acad, v.id, "PUBLISHED")).toMatch(/closing date/);
  });
  it("applications: CV must be a real PDF or DOCX under 4 MB; one per email per vacancy; closed vacancies refuse; screening score from answers (LEC-08)", async () => {
    const v = await vacancy(); const d = { fullName: "Grace Uwase", email: `grace.${u()}@example.com`, phone: "0788123456", answers: { "0": "yes", "1": "no" } };
    expect(await applyForJob(v.slug, d, cv())).toMatch(/closed/); await setVacancyStatus(acad, v.id, "PUBLISHED");
    expect(await applyForJob(v.slug, { ...d, email: "bad" }, cv())).toMatch(/valid email/); expect(await applyForJob(v.slug, d, null)).toMatch(/Attach your CV/); expect(await applyForJob(v.slug, d, cv(new Uint8Array([1, 2, 3]), "application/pdf"))).toMatch(/real PDF/);
    expect(await applyForJob(v.slug, d, cv(PDF, "image/png"))).toMatch(/PDF or Word/); expect(await applyForJob(v.slug, d, cv(new Uint8Array(4 * 1024 * 1024 + 1), "application/pdf"))).toMatch(/larger than 4 MB/);
    const r = await applyForJob(v.slug, d, cv()); expect(typeof r).toBe("object"); expect(await applyForJob(v.slug, { ...d, email: d.email.toUpperCase() }, cv())).toMatch(/already applied/);
    const j = await db.jobApplication.findUniqueOrThrow({ where: { reference: (r as { reference: string }).reference } }); expect([j.status, j.score, j.answers]).toEqual(["NEW", 50, { "Five years in cargo": "yes", "IATA DGR certificate": "no" }]);
    expect(typeof (await applyForJob(v.slug, { ...d, email: `docx.${u()}@example.com` }, cv(DOCX, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")))).toBe("object");
  });
  it("pipeline: allowed moves only, rejection needs a reason; offer after interview; offer letter is verifiable; hiring creates the lecturer and onboarding (LEC-08, LEC-10)", async () => {
    const v = await vacancy(); await setVacancyStatus(acad, v.id, "PUBLISHED"); const email = `hire.${u()}@example.com`; const r = await applyForJob(v.slug, { fullName: "Eric Hirwa", email, phone: "0788000111", answers: { "0": "yes", "1": "yes" } }, cv()) as { reference: string };
    const id = (await db.jobApplication.findUniqueOrThrow({ where: { reference: r.reference } })).id;
    expect(await moveJobApp(acad, id, "INTERVIEW")).toMatch(/cannot move/); expect(await moveJobApp(acad, id, "REJECTED")).toMatch(/reason/); expect(await moveJobApp(acad, id, "SHORTLISTED", "", 120)).toMatch(/0 to 100/);
    expect(await makeOffer(acad, id, { rate: "15000", startDate: future })).toMatch(/Interview the candidate/); expect(await moveJobApp(acad, id, "SHORTLISTED", "Strong cargo background", 85)).toBeNull(); expect(await moveJobApp(acad, id, "INTERVIEW")).toBeNull();
    expect(await hire(acad, id, "a-long-password")).toMatch(/Make an offer/); expect(await makeOffer(acad, id, { rate: "0", startDate: future })).toMatch(/whole number/); expect(await makeOffer(acad, id, { rate: "15000", startDate: "" })).toMatch(/start date/);
    expect(await makeOffer(acad, id, { rate: "15000", payModel: "HOUR", currency: "RWF", startDate: future })).toBeNull(); const o = await offerLetter(id); expect(o?.name).toBe(`OFFER-${r.reference}.pdf`); expect(new TextDecoder().decode(o!.pdf.slice(0, 5))).toBe("%PDF-");
    expect(await describeDoc(`OFFER-${r.reference}`)).toMatch(/Offer of engagement to Eric Hirwa/);
    expect(await hire(acad, id, "short")).toMatch(/10 characters/); const h = await hire(acad, id, "a-long-password"); expect(typeof h).toBe("object");
    const usr = await db.user.findUniqueOrThrow({ where: { email }, include: { lecturer: true } }); expect([usr.role, usr.lecturer?.rate, usr.lecturer?.payModel, usr.lecturer?.subjects, usr.lecturer?.contractStart?.toISOString().slice(0, 10)]).toEqual(["LECTURER", 15000, "HOUR", ["Cargo", "Dangerous goods"], future]);
    expect(await tickOnboarding(acad, id, "Free lunch", true)).toMatch(/Unknown/); for (const x of ONBOARDING.slice(0, 2)) expect(await tickOnboarding(acad, id, x, true)).toBeNull(); expect(await tickOnboarding(acad, id, ONBOARDING[1], false)).toBeNull();
    const j = await db.jobApplication.findUniqueOrThrow({ where: { id } }); expect([j.status, j.userId, onboardingDone(j.onboarding)]).toEqual(["HIRED", usr.id, 1]); expect(await moveJobApp(acad, id, "REJECTED", "late")).toMatch(/cannot move/);
  });
});
