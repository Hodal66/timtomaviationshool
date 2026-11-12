import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StartForm } from "@/components/StartForm";
import { getApplicantEmail, otpRequired } from "@/lib/otp";
import { getT } from "@/lib/i18n/server";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Start your application | Timtom Aviation School", robots: { index: false } };

/** Only same-site paths are allowed as the place to go after verifying. */
const safe = (n?: string) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "/me");
export default async function Start({ searchParams }: { searchParams: Promise<{ next?: string; email?: string; code?: string }> }) {
  const sp = await searchParams; const { t } = await getT(); const next = safe(sp.next);
  if (await getApplicantEmail()) redirect(next);
  return (<><section className="pagehead"><div className="wrap"><span className="eyebrow">{t("Apply online")}</span><h1>{t("Verify your email")}</h1>
    <p className="lead">{t("Step 1 of 2: confirm your email. Step 2: complete your application.")}</p></div></section>
    <section className="sx" style={{ paddingTop: 24 }}><div className="wrap">{otpRequired() ? <StartForm next={next} preEmail={sp.email} preCode={sp.code} /> : <div className="box" style={{ margin: "0 auto" }}><p>{t("Email verification is not available yet. You can still apply.")}</p><a className="btn pri" href="/apply">{t("Start your application")}</a></div>}</div></section></>);
}
