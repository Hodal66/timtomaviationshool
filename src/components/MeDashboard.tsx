"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type Col, type Row } from "@/components/dash/DataTable";
import { Icon } from "@/components/dash/icons";
import { useT } from "@/lib/i18n/client";

export type MeApp = { id: string; reference: string; programme: string; slug: string; branch: string; intake: string; session: string; status: string; statusLabel: string; next: string; at: string; name: string; phone: string; dob: string; verified: boolean;
  docs: { id: string; kind: string; status: string; note: string; file: { id: string; filename: string; size: number } | null }[]; invoices: { id: string; reference: string; description: string; amount: string; value: number; status: string; paid: string }[]; events: { at: string; message: string; actor: string }[] };
const tone = (s: string) => (["VERIFIED", "PAID", "ENROLLED", "ADMITTED"].includes(s) ? "ok" : ["MISSING", "REJECTED"].includes(s) ? "bad" : ["RECEIVED", "PENDING", "SUBMITTED", "DOCUMENTS_VERIFIED", "REGISTRATION_PAID"].includes(s) ? "warn" : "");

export function MeDashboard({ email, apps, stages }: { email: string; apps: MeApp[]; stages: { key: string; label: string }[] }) {
  const t = useT(); const router = useRouter(); const [tab, setTab] = useState<"overview" | "documents" | "payments" | "activity" | "profile">("overview"); const [toast, setToast] = useState(""); const [busy, setBusy] = useState("");
  const input = useRef<HTMLInputElement>(null); const target = useRef<{ ref: string; kind: string } | null>(null);
  const say = (m: string) => { setToast(m); setTimeout(() => setToast(""), 3500); };
  const L = (s: string) => t(s.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()));
  async function upload(file: File) {
    const tg = target.current; if (!tg) return; setBusy(tg.ref + tg.kind);
    const fd = new FormData(); fd.append("kind", tg.kind); fd.append("reference", tg.ref); fd.append("who", email); fd.append("file", file);
    try { const r = await fetch("/api/apply/upload", { method: "POST", body: fd }); const j = await r.json().catch(() => ({})); if (!r.ok) say(j.error ?? t("Upload failed.")); else { say(t("Uploaded: {name}", { name: file.name })); router.refresh(); } } catch { say(t("Network problem. Check your connection and try again.")); } finally { setBusy(""); }
  }
  const csv = () => { const head = ["Reference", "Programme", "Branch", "Intake", "Status", "Applied"].join(","); const body = apps.map((a) => [a.reference, a.programme, a.branch, a.intake, a.statusLabel, a.at].map((x) => `"${x.replace(/"/g, '""')}"`).join(",")).join("\n"); const el = document.createElement("a"); el.href = URL.createObjectURL(new Blob(["﻿" + head + "\n" + body], { type: "text/csv" })); el.download = "my-applications.csv"; el.click(); };
  const docRows: Row[] = apps.flatMap((a) => a.docs.map((d) => ({ id: d.id, v: { ref: a.reference, kind: d.kind, status: L(d.status), file: d.file?.filename ?? "" }, c: { status: <span className={`pill ${tone(d.status)}`}>{L(d.status)}</span>,
    file: d.file ? <a href={`/api/me/documents/${d.file.id}`}>{d.file.filename}</a> : <span style={{ color: "var(--muted)" }}>{t("Not uploaded")}</span>,
    act: <span style={{ display: "flex", gap: 6, alignItems: "center" }}><button className="s" disabled={busy === a.reference + d.kind} onClick={() => { target.current = { ref: a.reference, kind: d.kind }; input.current?.click(); }}><Icon n="upload" size={14} /> {d.file ? t("Replace") : t("Upload")}</button>{d.note && <small style={{ color: "var(--warn)" }}>{d.note}</small>}</span> } })));
  const dcols: Col[] = [{ key: "ref", label: t("Reference"), filter: true }, { key: "kind", label: t("Document"), filter: true }, { key: "status", label: t("Status"), filter: true }, { key: "file", label: t("File") }, { key: "act", label: "", sortable: false }];
  const payRows: Row[] = apps.flatMap((a) => a.invoices.map((i) => ({ id: i.id, v: { ref: i.reference, desc: i.description, amount: i.value, status: L(i.status), paid: i.paid }, c: { amount: i.amount, status: <span className={`pill ${i.status === "PAID" ? "ok" : "warn"}`}>{i.status === "PAID" ? t("Paid") : t("Awaiting payment")}</span> } })));
  const pcols: Col[] = [{ key: "ref", label: t("Invoice") }, { key: "desc", label: t("Description") }, { key: "amount", label: t("Amount"), align: "right" }, { key: "status", label: t("Status"), filter: true }, { key: "paid", label: t("Paid on") }];
  const evRows: Row[] = apps.flatMap((a) => a.events.map((e, i) => ({ id: a.id + i, v: { at: e.at, ref: a.reference, msg: e.message, by: e.actor } })));
  const ecols: Col[] = [{ key: "at", label: t("When") }, { key: "ref", label: t("Reference"), filter: true }, { key: "msg", label: t("What happened") }, { key: "by", label: t("By") }];
  const TABS = [["overview", "Overview"], ["documents", "Documents"], ["payments", "Payments"], ["activity", "Activity"], ["profile", "Profile"]] as const;
  const unpaid = apps.reduce((n, a) => n + a.invoices.filter((i) => i.status !== "PAID").length, 0); const missing = apps.reduce((n, a) => n + a.docs.filter((d) => d.status === "MISSING" || (!d.file && d.status === "PENDING")).length, 0);
  return (<>
    <div className="hero"><h1>{t("Welcome, {name}", { name: (apps[0]?.name ?? email.split("@")[0]).split(" ")[0] })}</h1><p>{t("Everything about your application in one place: progress, documents, payments and messages.")}</p>
      <p style={{ marginTop: 10 }}><span className="pill ok" style={{ background: "rgba(255,255,255,.2)", color: "#fff" }}>✓ {t("Email verified")}: {email}</span></p></div>
    <div className="kpis"><div className="kpi"><span>{t("Applications")}</span><b>{apps.length}</b></div><div className="kpi"><span>{t("Documents to provide")}</span><b>{missing}</b></div><div className="kpi"><span>{t("Invoices to pay")}</span><b>{unpaid}</b></div>
      <a href="/apply" className="kpi g" style={{ textDecoration: "none", color: "#fff" }}><span>{t("New application")}</span><b>+</b></a></div>
    <div className="tabs" role="tablist">{TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{t(l)}</button>)}</div>
    <input ref={input} type="file" hidden aria-label={t("Choose a file")} accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) upload(f); }} />
    {tab === "overview" && (apps.length === 0 ? <div className="panel empty"><p>{t("You have not applied yet.")}</p><a className="btn-p" style={{ display: "inline-block", padding: "10px 18px", borderRadius: 10, textDecoration: "none" }} href="/apply">{t("Start your application")}</a></div>
      : <div style={{ display: "grid", gap: 16 }}>{apps.map((a) => { const idx = stages.findIndex((s) => s.key === a.status); return (<div className="panel" key={a.id}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><div><h2 style={{ marginBottom: 2 }}>{a.programme}</h2><small style={{ color: "var(--muted)" }}>{t("Reference")}: <b>{a.reference}</b> · {a.branch} · {a.intake} · {a.session}</small></div><span className={`pill ${tone(a.status)}`} style={{ height: "fit-content" }}>{a.statusLabel}</span></div>
        <ol className="steps" aria-label={t("Application progress")}>{stages.map((s, i) => <li key={s.key} className={a.status === "REJECTED" ? "" : i < idx ? "done" : i === idx ? "now" : ""} aria-current={i === idx ? "step" : undefined}>{s.label}</li>)}</ol>
        <p style={{ margin: "8px 0 0" }}><b>{t("What happens next")}:</b> {a.next}</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}><button className="s" onClick={() => setTab("documents")}>{t("Documents")} ({a.docs.filter((d) => d.status === "VERIFIED").length}/{a.docs.length} {t("verified")})</button><button className="s" onClick={() => setTab("payments")}>{t("Payments")}</button><a className="s" style={{ padding: "4px 12px", border: "1px solid var(--line)", borderRadius: 10, textDecoration: "none" }} href={`/courses/${a.slug}`}>{t("View course")}</a></div></div>); })}</div>)}
    {tab === "documents" && <div className="panel"><h2>{t("My documents")}</h2><p style={{ color: "var(--muted)", marginTop: 0 }}>{t("JPG, PNG, WebP or PDF, up to 4 MB each. You can replace a file until it is verified.")}</p><DataTable id="me-docs" cols={dcols} rows={docRows} exportName="my-documents" empty={t("No documents yet.")} /></div>}
    {tab === "payments" && <div className="panel"><h2>{t("My invoices")}</h2><p style={{ color: "var(--muted)", marginTop: 0 }}>{t("After you pay by mobile money or bank, send the transaction reference to Finance. Your invoice is marked paid once they confirm it.")}</p><DataTable id="me-pay" cols={pcols} rows={payRows} exportName="my-invoices" empty={t("No invoices yet.")} /></div>}
    {tab === "activity" && <div className="panel"><h2>{t("Activity")}</h2><DataTable id="me-act" cols={ecols} rows={evRows} exportName="my-activity" empty={t("Nothing yet.")} /></div>}
    {tab === "profile" && <div className="panel"><h2>{t("My details")}</h2><dl style={{ display: "grid", gridTemplateColumns: "max-content 1fr", gap: "8px 18px" }}><dt style={{ color: "var(--muted)" }}>{t("Name")}</dt><dd style={{ margin: 0 }}>{apps[0]?.name ?? "-"}</dd><dt style={{ color: "var(--muted)" }}>Email</dt><dd style={{ margin: 0 }}>{email} <span className="pill ok">{t("Verified")}</span></dd><dt style={{ color: "var(--muted)" }}>{t("Phone")}</dt><dd style={{ margin: 0 }}>{apps[0]?.phone || "-"}</dd><dt style={{ color: "var(--muted)" }}>{t("Date of birth")}</dt><dd style={{ margin: 0 }}>{apps[0]?.dob || "-"}</dd></dl>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}><button className="s" onClick={csv}><Icon n="down" size={14} /> {t("Download my applications (CSV)")}</button><button className="s" onClick={() => print()}>{t("Print")}</button>
        <button className="s danger" onClick={async () => { await fetch("/api/otp/logout", { method: "POST" }); location.href = "/start"; }}>{t("Sign out")}</button></div></div>}
    {toast && <div className="toast" role="status">{toast}</div>}
  </>);
}
