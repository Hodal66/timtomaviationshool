import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { slugify } from "../src/lib/catalogue";
const db = new PrismaClient();

async function main() {
  const branches = await Promise.all([
    ["KGL", "Kigali", "Rwanda"], ["NYA", "Bugesera–Nyamata", "Rwanda"], ["GOM", "Goma", "DR Congo"],
  ].map(([code, name, country]) => db.branch.upsert({ where: { code }, update: {}, create: { code, name, country } })));

  const progs = await Promise.all([
    ["GRD", "IATA Ground Operations", "IATA", 600000, 450], ["CAB", "Cabin Crew", "ICAO", 550000, 420],
    ["TKT", "Airline Ticketing", "IATA", 500000, 380], ["CGO", "Cargo and Dangerous Goods", "ADVANCED_CERTIFICATE", 650000, 490],
    ["ICT", "ICT Certificate", "ICT", 300000, 230],
  ].map(([code, name, type, feeRwf, feeUsd]) => db.programme.upsert({ where: { code: code as string }, update: {},
    create: { code: code as string, name: name as string, type: type as never, feeRwf: feeRwf as number, feeUsd: feeUsd as number } })));

  // Retire the first prototype's sample courses (they have sample applicants, so they are archived, not deleted).
  for (const code of ["GRD", "CAB", "TKT", "CGO", "ICT"]) {
    const row = await db.programme.findUnique({ where: { code } });
    if (row && !row.name.endsWith("(sample)")) await db.programme.update({ where: { code }, data: { name: row.name + " (sample)", slug: (row.slug ?? code.toLowerCase()) + "-sample", status: "ARCHIVED", feeRwf: null, feeUsd: null, reviewNotes: "Sample row from the first prototype. Archived; kept for its sample applicants." } });
  }
  // Placeholder drafts from an earlier step are replaced by the imported catalogue below.
  for (const code of ["AVM", "CAM", "AAM", "APO", "FDP", "ASS", "TTM"]) {
    const row = await db.programme.findUnique({ where: { code }, include: { _count: { select: { applicants: true, offerings: true } } } });
    if (row && row._count.applicants === 0 && row._count.offerings === 0) await db.programme.delete({ where: { code } });
  }
  // The School's existing public course list (timtomaviation.com, read 12 Nov 2026). Already public there, so imported as published.
  // Created once. Later edits in the admin console are never overwritten.
  const imported = JSON.parse(readFileSync(join(__dirname, "imported-courses.json"), "utf8")) as { sourceId: number; name: string; category: string; qualificationType: string; summary: string; description: string; feeRwf: number | null; theme: string; image: string | null }[];
  const taken = new Set((await db.programme.findMany({ select: { slug: true } })).map((r) => r.slug));
  for (const c of imported) {
    const code = "TT" + c.sourceId;
    if (await db.programme.findUnique({ where: { code } })) continue;
    let slug = slugify(c.name); if (taken.has(slug)) slug += "-" + c.sourceId; taken.add(slug);
    await db.programme.create({ data: { code, name: c.name, slug, type: c.category as never, qualificationType: c.qualificationType, summary: c.summary, description: c.description, feeRwf: c.feeRwf,
      visualTheme: c.theme, heroImage: c.image, status: "PUBLISHED", publishedAt: new Date(), deliveryModes: [],
      reviewNotes: "Imported from the School's existing website. Duration, outcomes, entry requirements, certifying body and intakes are not on file yet.",
      events: { create: { actorName: "Import", action: "Imported from the existing public website as published" } } } });
  }

  const intake = await db.intake.upsert({ where: { label: "July 2027" }, update: {},
    create: { label: "July 2027", startsOn: new Date("2027-07-05"), endsOn: new Date("2027-12-31") } });

  // Demo data only on an empty database.
  if ((await db.applicant.count()) === 0) {
    const sample: [string, number, number, string][] = [
      ["Aline Uwase", 0, 0, "ENROLLED"], ["Diane Mukamana", 2, 0, "ADMITTED"], ["Eric Habimana", 1, 2, "SUBMITTED"],
      ["Patrick Nshuti", 2, 1, "DOCUMENTS_VERIFIED"], ["Grace Iradukunda", 4, 0, "REGISTRATION_PAID"], ["Moise Kabera", 1, 2, "ENROLLED"],
    ];
    const made = [];
    for (const [fullName, p, b, status] of sample)
      made.push(await db.applicant.create({ data: { fullName, status: status as never, programmeId: progs[p].id, branchId: branches[b].id, intakeId: intake.id } }));
    await db.payment.createMany({ data: [
      { reference: "TAS-A0412", amountMinor: 150000, channel: "MTN_MOMO", status: "RECONCILED", applicantId: made[0].id },
      { reference: "TAS-A0413", amountMinor: 420000, channel: "BANK_OF_KIGALI", status: "RECONCILED", applicantId: made[1].id },
      { reference: "TAS-A0418", amountMinor: 31000, currency: "USD", channel: "EQUITY", status: "RECONCILED", applicantId: made[3].id },
      { amountMinor: 75000, channel: "AIRTEL_MONEY", status: "UNMATCHED" },
      { reference: "TAS-A0421", amountMinor: 60000, channel: "MTN_MOMO", status: "PART_PAYMENT", applicantId: made[5].id },
    ] });
    await db.certificate.createMany({ data: [
      { number: "TAS-2027-004281", holderId: made[0].id, programmeId: progs[0].id, issuedOn: new Date("2028-01-14") },
      { number: "TAS-2026-003990", holderId: made[5].id, programmeId: progs[1].id, issuedOn: new Date("2026-12-10"), status: "REVOKED" },
    ] });
  }

  // Timetable demo data (idempotent).
  const kgl = branches[0];
  const unusable = await bcrypt.hash(Math.random().toString(36) + Date.now(), 4);
  const lect = [];
  for (const [email, name] of [["kamali@lecturers.tas.invalid", "Mr. Kamali"], ["mukeshimana@lecturers.tas.invalid", "Ms. Mukeshimana"]])
    lect.push(await db.user.upsert({ where: { email }, update: {}, create: { email, name, role: "LECTURER", passwordHash: unusable, branchId: kgl.id } }));
  const rooms = [];
  for (const name of ["Room 2", "Room 3", "Lab 1"])
    rooms.push(await db.room.upsert({ where: { branchId_name: { branchId: kgl.id, name } }, update: {}, create: { name, branchId: kgl.id, capacity: 30 } }));
  const grp = await db.classGroup.upsert({ where: { name: "IATA Ground Ops · Kigali · Jul 2027 · Weekday" }, update: {},
    create: { name: "IATA Ground Ops · Kigali · Jul 2027 · Weekday", programmeId: progs[0].id, branchId: kgl.id, intakeId: intake.id, session: "WEEKDAY" } });
  await db.applicant.updateMany({ where: { programmeId: progs[0].id, branchId: kgl.id, status: "ENROLLED", classGroupId: null }, data: { classGroupId: grp.id } });
  if ((await db.timetableSlot.count({ where: { groupId: grp.id } })) === 0) {
    await db.timetableSlot.createMany({ data: [
      { groupId: grp.id, roomId: rooms[0].id, lecturerId: lect[0].id, dayOfWeek: 1, startMin: 480, endMin: 600, subject: "Airport Ground Operations" },
      { groupId: grp.id, roomId: rooms[2].id, lecturerId: lect[1].id, dayOfWeek: 3, startMin: 480, endMin: 600, subject: "Passenger Handling" },
      { groupId: grp.id, roomId: rooms[0].id, lecturerId: lect[0].id, dayOfWeek: 4, startMin: 840, endMin: 960, subject: "Cargo Basics" },
    ] });
  }

  const email = process.env.ADMIN_EMAIL?.toLowerCase(), pw = process.env.ADMIN_PASSWORD;
  if (email && pw) {
    const passwordHash = await bcrypt.hash(pw, 12);
    await db.user.upsert({ where: { email }, update: {}, create: { email, name: "Administrator", role: "ADMIN", passwordHash } });
  } else console.log("ADMIN_EMAIL / ADMIN_PASSWORD not set: no admin user created.");
}
main().finally(() => db.$disconnect());
