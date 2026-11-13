import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import { label } from "@/lib/format";
import { MANAGERS } from "@/lib/lecturers";
import { moveJobApp, makeOffer, hire, tickOnboarding, ONBOARDING, onboardingDone, type Offer } from "@/lib/recruitment";
export const dynamic = "force-dynamic";
type Hist = { at: string; by: string; action: string; note?: string };
const actor = async () => { const s = await getSession(); if (!s || !MANAGERS.includes(s.role)) throw new Error("Not allowed"); return { uid: s.uid, name: s.name, role: s.role }; };
const back = (id: string, err: string | null) => redirect(`/recruitment/${id}?` + (err ? "e=" + encodeURIComponent(err) : "ok=1"));
async function move(to: string, fd: FormData) { "use server"; const id = String(fd.get("id")); const sc = String(fd.get("score") ?? ""); const err = await moveJobApp(await actor(), id, to, String(fd.get("note") ?? ""), sc ? Number(sc) : null); revalidatePath("/recruitment"); back(id, err); }
async function offer(fd: FormData) { "use server"; const id = String(fd.get("id")); const err = await makeOffer(await actor(), id, Object.fromEntries(["rate", "payModel", "currency", "startDate", "subjects"].map((k) => [k, String(fd.get(k) ?? "")]))); back(id, err); }
async function doHire(fd: FormData) { "use server"; const id = String(fd.get("id")); const r = await hire(await actor(), id, String(fd.get("password") ?? "")); revalidatePath("/lecturers"); back(id, typeof r === "string" ? r : null); }
async function tick(fd: FormData) { "use server"; const id = String(fd.get("id")); const err = await tickOnboarding(await actor(), id, String(fd.get("item")), fd.get("done") === "1"); back(id, err); }

/** LEC-08, LEC-10: one candidate: CV, screening answers, pipeline, offer letter, hiring and onboarding. */
export default async function Candidate({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ e?: string; ok?: string }> }) {
  const me = await getSession(); if (!me || !MANAGERS.includes(me.role)) redirect("/dashboard"); const { t } = await getT(); const sp = await searchParams;
  const j = await db.jobApplication.findUnique({ where: { id: (await params).id }, include: { vacancy: true }, omit: { cv: true } }); if (!j) notFound();
  const ans = j.answers as Record<string, string>, hist = j.history as Hist[], o = j.offer as Offer | null, ob = (j.onboarding ?? {}) as Record<string, { by: string; at: string } | null>;
  const open = ["NEW", "SHORTLISTED", "INTERVIEW", "OFFERED"].includes(j.status);
  return (<><div className="top"><div><h1>{j.fullName}</h1><p>{j.vacancy.title} · {j.reference} · <span className={`pill ${j.status === "HIRED" ? "ok" : ["REJECTED", "WITHDRAWN"].includes(j.status) ? "bad" : "warn"}`} id="job-status">{t(label(j.status))}</span></p></div><a href="/recruitment">{t("Back to recruitment")}</a></div>
    {sp.e && <p className="err" role="alert">{sp.e}</p>}{sp.ok && <p className="ok" role="status">{t("Saved.")}</p>}
    <div className="grid2" style={{ marginBottom: 16 }}>
      <div className="panel"><h2>{t("Application")}</h2><p style={{ margin: "0 0 8px" }}><a href={`mailto:${j.email}`}>{j.email}</a> · <a href={`tel:${j.phone}`}>{j.phone}</a><br /><a className="btn s" href={`/api/careers/cv/${j.id}`} download>{t("Download CV")}</a> <small>{j.cvName} · {Math.ceil(j.cvSize / 1024)} KB</small></p>
        <h3>{t("Screening")} {j.score != null && <span className="pill" id="job-score">{j.score}%</span>}</h3>{Object.keys(ans).length === 0 ? <p className="empty">{t("No screening questions.")}</p> : <ul>{Object.entries(ans).map(([q, a]) => <li key={q}>{q}: <b className={a === "yes" ? "ok" : "bad"}>{a === "yes" ? t("Yes") : t("No")}</b></li>)}</ul>}
        {j.coverNote && <><h3>{t("Cover note")}</h3><p style={{ whiteSpace: "pre-wrap" }}>{j.coverNote}</p></>}</div>
      <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
        {open && j.status !== "OFFERED" && <form className="panel" style={{ display: "grid", gap: 8 }}><h2 style={{ margin: 0 }}>{t("Decision")}</h2><input type="hidden" name="id" value={j.id} />
          <input name="note" placeholder={t("Note (needed to reject)")} aria-label={t("Note")} /><input name="score" type="number" min={0} max={100} placeholder={t("Score after review (0-100, optional)")} aria-label={t("Score")} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{j.status === "NEW" && <button className="p" formAction={move.bind(null, "SHORTLISTED")}>{t("Shortlist")}</button>}{j.status === "SHORTLISTED" && <button className="p" formAction={move.bind(null, "INTERVIEW")}>{t("Invite to interview")}</button>}<button className="danger" formAction={move.bind(null, "REJECTED")}>{t("Reject")}</button></div></form>}
        {j.status === "INTERVIEW" && <form className="panel" style={{ display: "grid", gap: 8 }} action={offer}><h2 style={{ margin: 0 }}>{t("Make an offer")}</h2><input type="hidden" name="id" value={j.id} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><label>{t("Rate")}<br /><input name="rate" type="number" min={1} required /></label><label>{t("Pay model")}<br /><select name="payModel" defaultValue={j.vacancy.payModel}>{["HOUR", "SESSION", "MODULE", "MONTHLY"].map((m) => <option key={m} value={m}>{t(label(m))}</option>)}</select></label>
            <label>{t("Currency")}<br /><select name="currency"><option>RWF</option><option>USD</option></select></label><label>{t("Start date")}<br /><input name="startDate" type="date" required /></label></div>
          <label htmlFor="of-s">{t("Subjects")}</label><input id="of-s" name="subjects" defaultValue={j.vacancy.subjects.join(", ")} /><button className="p" type="submit" style={{ justifySelf: "start" }}>{t("Make offer")}</button></form>}
        {o && <div className="panel"><h2>{t("Offer")}</h2><p style={{ margin: "0 0 8px" }}>{o.currency} {o.rate.toLocaleString("en-US")} · {t(label(o.payModel))} · {t("Start date")}: {o.startDate}</p><a className="btn s" href={`/api/careers/offer/${j.id}`} target="_blank" rel="noopener">{t("Offer letter (PDF)")}</a>
          {j.status === "OFFERED" && <><form style={{ display: "grid", gap: 8, marginTop: 10 }} action={doHire}><input type="hidden" name="id" value={j.id} /><label htmlFor="hi-p">{t("Offer accepted: first password for the lecturer account (at least 10 characters)")}</label><input id="hi-p" name="password" type="text" minLength={10} required autoComplete="off" /><button className="p" type="submit" style={{ justifySelf: "start" }}>{t("Hire and create account")}</button></form>
            <form style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}><input type="hidden" name="id" value={j.id} /><input name="note" placeholder={t("Reason")} aria-label={t("Reason")} /><button className="danger" formAction={move.bind(null, "WITHDRAWN")}>{t("Withdraw offer")}</button></form></>}</div>}
        {j.status === "HIRED" && <div className="panel" id="onboarding"><h2>{t("Onboarding")} <span className="pill">{onboardingDone(ob)} / {ONBOARDING.length}</span></h2>{j.userId && <p><a href={`/lecturers/${j.userId}`}>{t("Open the lecturer record")}</a></p>}
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>{ONBOARDING.map((x) => <li key={x} data-ob={x}><form action={tick} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><input type="hidden" name="id" value={j.id} /><input type="hidden" name="item" value={x} /><input type="hidden" name="done" value={ob[x] ? "0" : "1"} />
            <button className={ob[x] ? "s" : "s p"} type="submit" aria-pressed={!!ob[x]}>{ob[x] ? "✓" : "○"}</button><span>{t(x)}</span>{ob[x] && <small style={{ color: "var(--muted)" }}>{ob[x]!.by} · {ob[x]!.at.slice(0, 10)}</small>}</form></li>)}</ul></div>}
        <div className="panel"><h2>{t("History")}</h2><ul className="tl">{hist.map((h, i) => <li key={i}>{h.at.slice(0, 16).replace("T", " ")} · {h.by} · <b>{h.action}</b>{h.note ? ` · ${h.note}` : ""}</li>)}</ul></div></div></div></>);
}
