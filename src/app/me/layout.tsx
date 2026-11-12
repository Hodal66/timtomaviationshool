import { redirect } from "next/navigation";
import { getApplicantEmail, destroyApplicantSession } from "@/lib/otp";
import { getT } from "@/lib/i18n/server";
import { db } from "@/lib/db";
import { Shell, type NavItem } from "@/components/dash/Shell";

async function logout() { "use server"; await destroyApplicantSession(); redirect("/start"); }
export default async function MeLayout({ children }: { children: React.ReactNode }) {
  const email = await getApplicantEmail(); if (!email) redirect("/start?next=/me");
  const { t } = await getT();
  const a = await db.applicant.findFirst({ where: { email }, orderBy: { createdAt: "desc" }, select: { fullName: true } });
  const nav: NavItem[] = [{ href: "/me", label: t("My dashboard"), icon: "home" }, { href: "/apply", label: t("New application"), icon: "plus" }, { href: "/courses", label: t("Courses"), icon: "book" }, { href: "/verify", label: t("Verify a certificate"), icon: "award" }, { href: "/", label: t("Home"), icon: "globe" }];
  return <Shell brand="Timtom Aviation" nav={nav} user={{ name: a?.fullName ?? email.split("@")[0], sub: email }} logout={logout}>{children}</Shell>;
}
