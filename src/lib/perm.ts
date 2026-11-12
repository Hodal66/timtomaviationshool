import type { Role } from "@prisma/client";
export const can = {
  editContent: (r: Role) => ["ADMIN", "ACADEMIC", "MARKETING"].includes(r),
  approve: (r: Role) => ["ADMIN", "ACADEMIC"].includes(r),
  publish: (r: Role) => r === "ADMIN",
  enquiries: (r: Role) => ["ADMIN", "ADMISSIONS", "MARKETING", "BRANCH_MANAGER"].includes(r),
  admissions: (r: Role) => ["ADMIN", "ADMISSIONS", "BRANCH_MANAGER"].includes(r),
  /** Read access to applicant records and invoices (least privilege: no lecturers, marketing or academic staff). */
  viewApplicants: (r: Role) => ["ADMIN", "ADMISSIONS", "BRANCH_MANAGER", "FINANCE"].includes(r),
  finance: (r: Role) => ["ADMIN", "FINANCE"].includes(r),
  reports: (r: Role) => ["ADMIN", "BRANCH_MANAGER", "MARKETING", "ACADEMIC", "FINANCE", "ADMISSIONS"].includes(r),
};
