import { db } from "./db";

export type OfferingView = Awaited<ReturnType<typeof listOfferings>>[number];

/** Offerings for a programme with live seats left. An offering accepts applications only if OPEN, not past deadline and not full. */
export async function listOfferings(programmeId: string, opts: { onlyOpen?: boolean } = {}) {
  const rows = await db.programmeOffering.findMany({
    where: { programmeId, ...(opts.onlyOpen ? { status: "OPEN" } : {}) },
    include: { intake: true, branch: true }, orderBy: { intake: { startsOn: "asc" } },
  });
  const taken = await db.applicant.groupBy({
    by: ["programmeId", "intakeId", "branchId", "session"],
    where: { programmeId, status: { not: "REJECTED" } }, _count: true,
  });
  const now = new Date();
  return rows.map((o) => {
    const used = taken.find((t) => t.intakeId === o.intakeId && t.branchId === o.branchId && t.session === o.session)?._count ?? 0;
    const seatsLeft = Math.max(0, o.seats - used);
    const pastDeadline = !!o.deadline && o.deadline < now;
    const accepting = o.status === "OPEN" && !pastDeadline && seatsLeft > 0;
    return { ...o, seatsLeft, pastDeadline, accepting };
  });
}

/** Every open offering for published programmes in two queries, for the application wizard. */
export async function openOfferingsByProgramme() {
  const rows = await db.programmeOffering.findMany({ where: { status: "OPEN", programme: { status: "PUBLISHED" } }, include: { intake: true, branch: true }, orderBy: { intake: { startsOn: "asc" } } });
  const taken = await db.applicant.groupBy({ by: ["programmeId", "intakeId", "branchId", "session"], where: { status: { not: "REJECTED" }, programmeId: { in: [...new Set(rows.map((r) => r.programmeId))] } }, _count: true });
  const now = new Date(), out = new Map<string, { id: string; intake: string; branch: string; session: "WEEKDAY" | "WEEKEND"; seatsLeft: number; deadline: string | null; accepting: boolean }[]>();
  for (const o of rows) {
    const used = taken.find((t) => t.programmeId === o.programmeId && t.intakeId === o.intakeId && t.branchId === o.branchId && t.session === o.session)?._count ?? 0;
    const seatsLeft = Math.max(0, o.seats - used), past = !!o.deadline && o.deadline < now;
    const list = out.get(o.programmeId) ?? []; list.push({ id: o.id, intake: o.intake.label, branch: o.branch.name, session: o.session, seatsLeft, deadline: o.deadline?.toISOString().slice(0, 10) ?? null, accepting: seatsLeft > 0 && !past }); out.set(o.programmeId, list);
  }
  return out;
}
