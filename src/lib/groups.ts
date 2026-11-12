import type { Programme } from "@prisma/client";
export const GROUPS = [
  { id: "local-certificates", n: "01", title: "Local Certificates Courses", test: (p: Pick<Programme, "type" | "qualificationType">) => p.type === "CERTIFICATE" && p.qualificationType !== "Internship" },
  { id: "local-advanced", n: "02", title: "Local Advanced Courses", test: (p: Pick<Programme, "type" | "qualificationType">) => p.type === "ADVANCED_CERTIFICATE" },
  { id: "international", n: "03", title: "International Certificate Courses in Aviation", test: (p: Pick<Programme, "type" | "qualificationType">) => p.type === "IATA" || p.type === "ICAO" },
  { id: "ict", n: "04", title: "Local Certificates in Computer Skills", test: (p: Pick<Programme, "type" | "qualificationType">) => p.type === "ICT" && p.qualificationType !== "Internship" },
  { id: "internships", n: "05", title: "Available Internships", test: (p: Pick<Programme, "type" | "qualificationType">) => p.qualificationType === "Internship" },
];
