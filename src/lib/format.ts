export const money = (minor: number, cur: string) =>
  `${cur} ${(cur === "USD" ? minor / 100 : minor).toLocaleString("en-US")}`;
export const label = (s: string) => s.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
export const STAGES = ["SUBMITTED", "DOCUMENTS_VERIFIED", "REGISTRATION_PAID", "ADMITTED", "ENROLLED"] as const;
