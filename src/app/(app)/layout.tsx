import { redirect } from "next/navigation";
import { getSession, destroySession } from "@/lib/session";
import { can } from "@/lib/perm";
import { db } from "@/lib/db";
import { getT, dictFor } from "@/lib/i18n/server";
import { I18nProvider } from "@/lib/i18n/client";
import { Shell, type NavItem } from "@/components/dash/Shell";

async function logout() { "use server"; await destroySession(); redirect("/login"); }
const ROLE: Record<string, string> = { ADMIN: "Administrator", ADMISSIONS: "Admissions", FINANCE: "Finance", ACADEMIC: "Academic", MARKETING: "Marketing", BRANCH_MANAGER: "Branch manager", LECTURER: "Lecturer" };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  if (!s) redirect("/login");
  if (!(await db.user.findUnique({ where: { id: s.uid }, select: { active: true } }))?.active) redirect("/login"); // archived while signed in: cookies cannot be cleared during rendering, so the account is simply refused
  const { t, lang } = await getT(); const r = s.role;
  const nav: (NavItem | false)[] = [
    { href: "/dashboard", label: t("Dashboard"), icon: "home" }, can.reports(r) && { href: "/executive", label: t("Executive"), icon: "chart" },
    can.viewApplicants(r) && { href: "/admissions", label: t("Admissions"), icon: "users" }, can.enquiries(r) && { href: "/enquiries", label: t("Enquiries"), icon: "mail" },
    can.admissions(r) && { href: "/requests", label: t("Requests"), icon: "file" }, can.reports(r) && { href: "/support", label: t("Support"), icon: "mail" }, can.admissions(r) && { href: "/messages", label: t("Messages"), icon: "mail" }, can.editContent(r) && { href: "/admin/courses", label: t("Courses"), icon: "book" },
    r === "ADMIN" && { href: "/admin/users", label: t("Staff"), icon: "user" }, can.editContent(r) && { href: "/media", label: t("Media"), icon: "image" }, can.viewApplicants(r) && { href: "/payments", label: t("Payments"), icon: "card" },
    ["ADMIN", "ACADEMIC", "LECTURER"].includes(r) && { href: "/assessments", label: t("Assessments"), icon: "chart" }, ["ADMIN", "ACADEMIC", "ADMISSIONS"].includes(r) && { href: "/exams", label: t("Exams"), icon: "file" }, can.reports(r) && { href: "/certificates", label: t("Certificates"), icon: "award" }, r === "LECTURER" && { href: "/teach", label: t("My teaching"), icon: "book" }, ["ADMIN", "ACADEMIC", "LECTURER"].includes(r) && { href: "/resources", label: t("Resources"), icon: "file" }, ["ADMIN", "ACADEMIC", "BRANCH_MANAGER", "FINANCE"].includes(r) && { href: "/lecturers", label: t("Lecturers"), icon: "users" }, ["ADMIN", "ACADEMIC", "BRANCH_MANAGER", "FINANCE"].includes(r) && { href: "/claims", label: t("Pay claims"), icon: "money" }, ["ADMIN", "ACADEMIC", "BRANCH_MANAGER"].includes(r) && { href: "/recruitment", label: t("Recruitment"), icon: "user" }, { href: "/timetable", label: t("Timetable"), icon: "cal" }, { href: "/attendance", label: t("Attendance"), icon: "check" },
  ];
  return <I18nProvider lang={lang} dict={dictFor(lang)}><Shell brand="TAS-One" nav={nav.filter(Boolean) as NavItem[]} user={{ name: s.name, sub: t(ROLE[r] ?? r) }} logout={logout}>{children}</Shell></I18nProvider>;
}
