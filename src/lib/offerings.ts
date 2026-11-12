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
