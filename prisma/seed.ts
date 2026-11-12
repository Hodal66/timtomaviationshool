import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
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

  const email = process.env.ADMIN_EMAIL?.toLowerCase(), pw = process.env.ADMIN_PASSWORD;
  if (email && pw) {
    const passwordHash = await bcrypt.hash(pw, 12);
    await db.user.upsert({ where: { email }, update: {}, create: { email, name: "Administrator", role: "ADMIN", passwordHash } });
  } else console.log("ADMIN_EMAIL / ADMIN_PASSWORD not set: no admin user created.");
}
main().finally(() => db.$disconnect());
