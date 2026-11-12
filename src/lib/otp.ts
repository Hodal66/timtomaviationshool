import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db } from "./db";
import { emailConfigured, sendEmail } from "./notify";
import { limited, exhausted } from "./ratelimit";
import { SITE } from "./site";
import { makeT } from "./i18n/server";
import type { Lang } from "./i18n";

/** Verification is enforced only when the school can actually send email; until SMTP_PASS is set the old open route keeps working. */
export const otpRequired = () => emailConfigured();
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TTL_MIN = 10, MAX_TRIES = 5;
const key = () => new TextEncoder().encode(process.env.AUTH_SECRET ?? "");
const hash = (email: string, code: string) => createHash("sha256").update(`${email}|${code}|${process.env.AUTH_SECRET ?? ""}`).digest("hex");
export const normEmail = (e: unknown) => (typeof e === "string" ? e.trim().toLowerCase().slice(0, 160) : "");

export type OtpResult = { ok: true } | { ok: false; error: string; status: number };

/** Creates and emails a 6-digit code. The code is valid for 10 minutes; a newer code replaces older ones. */
export async function requestOtp(emailRaw: unknown, lang: Lang, ip: string): Promise<OtpResult> {
  const t = makeT(lang), email = normEmail(emailRaw);
  if (!EMAIL_RE.test(email)) return { ok: false, status: 400, error: t("Enter a valid email address.") };
  if (limited(`otp-send:${email}`, 5, 3600e3) || limited(`apply-otp-ip:${ip}`, 30, 3600e3)) return { ok: false, status: 429, error: t("Too many codes requested. Please wait a while and try again.") };
  if (!emailConfigured()) return { ok: false, status: 503, error: t("We cannot send email right now. Please contact admissions.") };
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db.emailOtp.updateMany({ where: { email, consumedAt: null }, data: { consumedAt: new Date() } });
  await db.emailOtp.create({ data: { email, codeHash: hash(email, code), expiresAt: new Date(Date.now() + TTL_MIN * 60e3) } });
  const link = `${SITE.url}/start?email=${encodeURIComponent(email)}&code=${code}`;
  try {
    await sendEmail(email, t("Your Timtom Aviation School verification code: {code}", { code }),
      [t("Your verification code is {code}.", { code }), "", t("It is valid for {n} minutes. Enter it on the page, or open this link to continue:", { n: TTL_MIN }), link, "", t("If you did not ask for this code, you can ignore this email."), "", SITE.name].join("\n"));
  } catch { return { ok: false, status: 502, error: t("We could not send the email. Check the address and try again.") }; }
  void db.emailOtp.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 24 * 3600e3) } } }).catch(() => {});
  return { ok: true };
}

/** Checks a code (max 5 tries per code). On success the code is used up. */
export async function verifyOtp(emailRaw: unknown, codeRaw: unknown, lang: Lang): Promise<OtpResult> {
  const t = makeT(lang), email = normEmail(emailRaw), code = typeof codeRaw === "string" ? codeRaw.replace(/\D/g, "") : "";
  const bad = { ok: false as const, status: 400, error: t("That code is not correct or has expired.") };
  if (!EMAIL_RE.test(email) || code.length !== 6) return bad;
  if (exhausted(`otp-verify:${email}`, 20)) return { ok: false, status: 429, error: t("Too many attempts. Please wait a while and try again.") };
  const row = await db.emailOtp.findFirst({ where: { email, consumedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } });
  if (!row || row.attempts >= MAX_TRIES) { limited(`otp-verify:${email}`, 20, 3600e3); return bad; }
  const ok = timingSafeEqual(Buffer.from(row.codeHash), Buffer.from(hash(email, code)));
  if (!ok) { await db.emailOtp.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } }); limited(`otp-verify:${email}`, 20, 3600e3); return bad; }
  await db.emailOtp.update({ where: { id: row.id }, data: { consumedAt: new Date() } });
  await db.applicant.updateMany({ where: { email, emailVerifiedAt: null }, data: { emailVerifiedAt: new Date() } });
  return { ok: true };
}

/* ---- Applicant session (separate from staff sessions) ---- */
const COOKIE = "tas_me";
const secure = () => !/^http:\/\/localhost/.test(process.env.NEXT_PUBLIC_SITE_URL ?? "");
export async function createApplicantSession(email: string) {
  const token = await new SignJWT({ email, kind: "applicant" }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("30d").sign(key());
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: secure(), sameSite: "lax", path: "/", maxAge: 30 * 86400 });
}
export async function destroyApplicantSession() { (await cookies()).delete(COOKIE); }
/** The verified email of the signed-in applicant, or null. */
export async function getApplicantEmail(): Promise<string | null> {
  const t = (await cookies()).get(COOKIE)?.value; if (!t || !process.env.AUTH_SECRET) return null;
  try { const { payload } = await jwtVerify(t, key()); return payload.kind === "applicant" && typeof payload.email === "string" ? payload.email : null; } catch { return null; }
}
