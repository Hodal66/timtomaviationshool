import type { Role } from "@prisma/client";
export const can = {
  editContent: (r: Role) => ["ADMIN", "ACADEMIC", "MARKETING"].includes(r),
  approve: (r: Role) => ["ADMIN", "ACADEMIC"].includes(r),
  publish: (r: Role) => r === "ADMIN",
  admissions: (r: Role) => ["ADMIN", "ADMISSIONS", "BRANCH_MANAGER"].includes(r),
  finance: (r: Role) => ["ADMIN", "FINANCE"].includes(r),
  reports: (r: Role) => ["ADMIN", "BRANCH_MANAGER", "MARKETING", "ACADEMIC", "FINANCE", "ADMISSIONS"].includes(r),
};
