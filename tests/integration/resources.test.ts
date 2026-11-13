import { describe, it, expect } from "vitest";
import { db, uniquePhone } from "./db";
import type { Actor } from "@/lib/lecturers";
import { createResource, updateResource, addVersion, reviewResource, trashResource, restoreResource, purgeResource, purgeBin, copyModule, studentResources, cleanSrc, staffCanSee } from "@/lib/resources";

let n = 0; const u = () => `${Date.now().toString(36)}${n++}`;
const acad: Actor = { uid: "", name: "Academic Head", role: "ACADEMIC" }, lec: Actor = { uid: "", name: "Lecturer One", role: "LECTURER" }, lec2: Actor = { uid: "", name: "Lecturer Two", role: "LECTURER" };
const PDF = new TextEncoder().encode("%PDF-1.4\nnotes\n"), DOCX = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 9, 9]);
const pdf = (name = "notes.pdf") => ({ file: { name, type: "application/pdf", bytes: PDF } });
async function setup() {
  for (const a of [acad, lec, lec2]) if (!a.uid) a.uid = (await db.user.create({ data: { email: `r.${u()}@test.local`, name: a.name, role: a.role as never, passwordHash: "x" } })).id;
  const prog = await db.programme.create({ data: { code: "RES" + u(), name: "Res Prog " + u(), type: "CERTIFICATE", status: "DRAFT" } }); const br = await db.branch.findFirstOrThrow(); const it = await db.intake.findFirstOrThrow();
  const email = `stud.${u()}@example.com`; await db.applicant.create({ data: { fullName: "Res Student", email, phone: uniquePhone(), reference: "TAS-R-" + u().toUpperCase(), status: "ENROLLED", programmeId: prog.id, branchId: br.id, intakeId: it.id } });
  return { prog, email };
}
describe("learning resources (RES)", () => {
  it("checks files by content, size and link format", () => {
    expect(cleanSrc({})).toMatch(/Choose a file/); expect(cleanSrc({ file: { name: "x.pdf", type: "application/pdf", bytes: new Uint8Array([1, 2, 3, 4]) } })).toMatch(/does not match/); expect(cleanSrc({ file: { name: "x.exe", type: "application/x-msdownload", bytes: PDF } })).toMatch(/Upload PDF/);
    expect(cleanSrc({ file: { name: "x.pdf", type: "application/pdf", bytes: new Uint8Array(4 * 1024 * 1024 + 1) } })).toMatch(/larger than 4 MB/); expect(cleanSrc({ url: "http://example.com" })).toMatch(/https/); expect(cleanSrc({ url: "https://youtu.be/abc" })).toEqual({ url: "https://youtu.be/abc" });
  });
  it("lecturer uploads wait for review; students see only approved, released, unexpired, student-visible items of their programme", async () => {
    const { prog, email } = await setup(); expect(await createResource({ ...lec, role: "FINANCE" }, { title: "X" }, pdf())).toMatch(/Not allowed/); expect(await createResource(lec, { title: "Hi" }, pdf())).toMatch(/title/);
    expect(await createResource(lec, { title: "Word file", viewOnly: true }, { file: { name: "a.docx", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", bytes: DOCX } })).toMatch(/View-only works/);
    const base = { programmeId: prog.id, module: "Air law" }; const r1 = await createResource(lec, { ...base, title: "Chicago Convention notes" }, pdf()) as { id: string };
    const r2 = await createResource(acad, { ...base, title: "Released later", releaseAt: "2099-01-01" }, pdf()) as { id: string }; const r3 = await createResource(acad, { ...base, title: "Expired", releaseAt: "2020-01-01", expiresAt: "2021-01-01" }, pdf()) as { id: string };
    const r4 = await createResource(acad, { ...base, title: "Staff guide", visibility: "STAFF" }, pdf()) as { id: string }; const r5 = await createResource(acad, { ...base, title: "Annex 1 video", kind: "VIDEO", viewOnly: true }, { url: "https://youtu.be/xyz" }) as { id: string };
    expect(await createResource(acad, { ...base, title: "Bad dates", releaseAt: "2026-02-01", expiresAt: "2026-01-01" }, pdf())).toMatch(/expiry must be after/);
    expect((await db.resource.findUniqueOrThrow({ where: { id: r1.id } })).status).toBe("IN_REVIEW"); expect((await db.resource.findUniqueOrThrow({ where: { id: r2.id } })).status).toBe("APPROVED");
    let seen = (await studentResources(email)).map((x) => x.title); expect(seen).toEqual(["Annex 1 video"]);
    expect(await reviewResource(lec, r1.id, true)).toMatch(/Only Academic/); expect(await reviewResource(acad, r1.id, false)).toMatch(/Say what/); expect(await reviewResource(acad, r1.id, true, "Good")).toBeNull();
    seen = (await studentResources(email)).map((x) => x.title); expect(seen.sort()).toEqual(["Annex 1 video", "Chicago Convention notes"]); expect(seen).not.toContain("Staff guide"); void r3; void r4; void r5;
    expect(await studentResources(email, new Date("2099-06-01"))).toHaveLength(3);
  });
  it("versions keep history; a lecturer's edit or new version goes back to review; others cannot edit; staff visibility rules", async () => {
    const { prog } = await setup(); const r = await createResource(lec, { programmeId: prog.id, module: "Safety", title: "Fire safety slides" }, pdf()) as { id: string }; await reviewResource(acad, r.id, true);
    expect(await addVersion(lec2, r.id, pdf())).toMatch(/Not allowed/); expect(await updateResource(lec2, r.id, { title: "Hacked" })).toMatch(/Not allowed/);
    expect(await addVersion(lec, r.id, pdf("v2.pdf"), "Added chapter 3")).toBeNull(); let x = await db.resource.findUniqueOrThrow({ where: { id: r.id }, include: { versions: true } }); expect([x.version, x.status, x.versions.length]).toEqual([2, "IN_REVIEW", 2]);
    await reviewResource(acad, r.id, true); expect(await updateResource(acad, r.id, { title: "Fire safety slides 2026", programmeId: prog.id, module: "Safety" })).toBeNull(); x = await db.resource.findUniqueOrThrow({ where: { id: r.id }, include: { versions: true } }); expect([x.title, x.status]).toEqual(["Fire safety slides 2026", "APPROVED"]);
    expect(await updateResource(lec, r.id, { title: "Fire safety slides v3", programmeId: prog.id, module: "Safety" })).toBeNull(); expect((await db.resource.findUniqueOrThrow({ where: { id: r.id } })).status).toBe("IN_REVIEW");
    const draft = await db.resource.findUniqueOrThrow({ where: { id: r.id } }); expect([staffCanSee(lec, draft), staffCanSee(lec2, draft), staffCanSee(acad, draft)]).toEqual([true, false, true]);
  });
  it("recycle bin: delete, restore, purge only from the bin, automatic purge after 30 days; module copy", async () => {
    const { prog } = await setup(); const other = await db.programme.create({ data: { code: "RES" + u(), name: "Res Other " + u(), type: "CERTIFICATE", status: "DRAFT" } });
    const a = await createResource(acad, { programmeId: prog.id, module: "Cargo", title: "Cargo basics" }, pdf()) as { id: string }; await createResource(acad, { programmeId: prog.id, module: "Cargo", title: "Cargo video" }, { url: "https://youtu.be/c" });
    expect(await purgeResource(acad, a.id)).toMatch(/recycle bin first/); expect(await trashResource(acad, a.id)).toBeNull(); expect(await updateResource(acad, a.id, { title: "Edit" })).toMatch(/Restore it/); expect(await restoreResource(acad, a.id)).toBeNull(); expect(await trashResource(lec, a.id)).toMatch(/Not allowed/);
    expect(await copyModule(lec, { programmeId: prog.id, module: "Cargo" }, { programmeId: other.id, module: "Cargo" })).toMatch(/Only Academic/); expect(await copyModule(acad, { programmeId: prog.id, module: "Nope" }, { programmeId: other.id, module: "Cargo" })).toMatch(/no resources/);
    expect(await copyModule(acad, { programmeId: prog.id, module: "Cargo" }, { programmeId: other.id, module: "Cargo 2027" })).toEqual({ copied: 2 }); const c = await db.resource.findMany({ where: { programmeId: other.id }, include: { versions: true } }); expect(c.map((x) => [x.module, x.version, x.versions.length]).sort()).toEqual([["Cargo 2027", 1, 1], ["Cargo 2027", 1, 1]]);
    await trashResource(acad, a.id); await db.resource.update({ where: { id: a.id }, data: { deletedAt: new Date(Date.now() - 31 * 864e5) } }); await purgeBin(); expect(await db.resource.count({ where: { id: a.id } })).toBe(0);
  });
});
