"use client";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/client";

/** Step 1: the email address. Step 2: the 6-digit code we email to it. Then the applicant goes to their dashboard. */
export function StartForm({ next, preEmail, preCode }: { next: string; preEmail?: string; preCode?: string }) {
  const t = useT(); const [email, setEmail] = useState(preEmail ?? ""); const [code, setCode] = useState(preCode ?? ""); const [step, setStep] = useState<"email" | "code">(preEmail && preCode ? "code" : "email");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [info, setInfo] = useState(""); const [wait, setWait] = useState(0); const codeRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (wait <= 0) return; const id = setTimeout(() => setWait(wait - 1), 1000); return () => clearTimeout(id); }, [wait]);
  useEffect(() => { if (step === "code") codeRef.current?.focus(); }, [step]);
  async function send(e?: React.FormEvent) {
    e?.preventDefault(); setErr(""); setInfo(""); setBusy(true);
    try { const r = await fetch("/api/otp/request", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) }); const j = await r.json();
      if (!j.ok) setErr(j.error ?? t("Something went wrong. Try again.")); else { setStep("code"); setCode(""); setWait(45); setInfo(t("We sent a 6-digit code to {email}. It is valid for 10 minutes.", { email })); } }
    catch { setErr(t("Network problem. Check your connection and try again.")); } finally { setBusy(false); }
  }
  async function verify(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setBusy(true);
    try { const r = await fetch("/api/otp/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, code }) }); const j = await r.json();
      if (j.ok) { location.href = next; return; } setErr(j.error ?? t("That code is not correct or has expired.")); }
    catch { setErr(t("Network problem. Check your connection and try again.")); } finally { setBusy(false); }
  }
  return (<div className="box" style={{ maxWidth: 440, margin: "0 auto" }}>
    {step === "email" ? <form onSubmit={send} style={{ display: "grid", gap: 12 }} noValidate>
      <h2 style={{ margin: 0 }}>{t("Verify your email")}</h2><p style={{ margin: 0, color: "var(--muted)" }}>{t("Enter your email address. We will send you a 6-digit code to confirm it is really yours. Then you can apply and follow your application from your own dashboard.")}</p>
      <label htmlFor="otp-email">{t("Email address")}</label><input id="otp-email" type="email" inputMode="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
      {err && <p className="err" role="alert" id="otp-err">{err}</p>}
      <button className="p" type="submit" disabled={busy || !email}>{busy ? t("Sending...") : t("Send me a code")}</button>
    </form> : <form onSubmit={verify} style={{ display: "grid", gap: 12 }}>
      <h2 style={{ margin: 0 }}>{t("Enter your code")}</h2>{info && <p style={{ margin: 0, color: "var(--muted)" }} role="status">{info}</p>}
      {!info && <p style={{ margin: 0, color: "var(--muted)" }}>{t("Enter the 6-digit code sent to {email}.", { email })}</p>}
      <label htmlFor="otp-code">{t("6-digit code")}</label><input id="otp-code" ref={codeRef} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} style={{ fontSize: 24, letterSpacing: 10, textAlign: "center" }} />
      {err && <p className="err" role="alert" id="otp-err">{err}</p>}
      <button className="p" type="submit" disabled={busy || code.length !== 6}>{busy ? t("Checking...") : t("Confirm and continue")}</button>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="s" onClick={() => { setStep("email"); setErr(""); setInfo(""); }}>{t("Change email")}</button>
        <button type="button" className="s" disabled={wait > 0 || busy} onClick={() => send()}>{wait > 0 ? t("Send again in {n}s", { n: wait }) : t("Send a new code")}</button></div>
    </form>}
  </div>);
}
