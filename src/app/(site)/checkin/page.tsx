import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getApplicantEmail, otpRequired } from "@/lib/otp";
import { CheckIn } from "@/components/CheckIn";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Class check-in | Timtom Aviation School", robots: { index: false } };
export default async function CheckInPage({ searchParams }: { searchParams: Promise<{ s?: string; c?: string }> }) {
  const sp = await searchParams; const s = sp.s ?? "", c = sp.c ?? "";
  if (!(await getApplicantEmail()) && otpRequired()) redirect("/start?next=" + encodeURIComponent(`/checkin?s=${encodeURIComponent(s)}&c=${encodeURIComponent(c)}`));
  return (<section className="sx"><div className="wrap"><div className="box" style={{ margin: "0 auto", maxWidth: 440 }}><CheckIn s={s} c={c} /></div></div></section>);
}
