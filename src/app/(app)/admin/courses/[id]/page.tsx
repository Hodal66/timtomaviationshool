import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession, type Session } from "@/lib/session";
import { can } from "@/lib/perm";
import { asFaqs, asModules, categoryLabel, readinessProblems, slugify, THEMES, THEME_KEYS } from "@/lib/catalogue";
import { label } from "@/lib/format";
export const dynamic = "force-dynamic";

const lines = (v: FormDataEntryValue | null) => String(v ?? "").split("\n").map((x) => x.trim()).filter(Boolean);
const num = (v: FormDataEntryValue | null) => { const n = parseInt(String(v ?? "").replace(/[^\d]/g, ""), 10); return Number.isFinite(n) ? n : null; };
async function who(need: (r: Session["role"]) => boolean) { const s = await getSession(); if (!s || !need(s.role)) throw new Error("Not allowed"); return s; }
const refresh = (slug?: string | null) => { revalidatePath("/"); revalidatePath("/courses"); if (slug) revalidatePath(`/courses/${slug}`); revalidatePath("/apply"); };

async function save(fd: FormData) {
  "use server";
  const s = await who(can.editContent);
  const id = String(fd.get("id"));
  const cur = await db.programme.findUnique({ where: { id } });
  if (!cur) return;
  if (cur.status === "PUBLISHED" || cur.status === "ARCHIVED") redirect(`/admin/courses/${id}?e=${encodeURIComponent("Unpublish the course before editing it.")}`);
  const slug = slugify(String(fd.get("slug") ?? "") || String(fd.get("name") ?? ""));
  const clash = await db.programme.findFirst({ where: { slug, id: { not: id } } });
  if (clash) redirect(`/admin/courses/${id}?e=${encodeURIComponent("That web address is already used.")}`);
  const modules = lines(fd.get("modules")).map((l) => { const [name, ...d] = l.split("|"); return { name: name.trim(), description: d.join("|").trim() || undefined }; });
  const faqs = lines(fd.get("faqs")).map((l) => { const [q, ...a] = l.split("|"); return { q: q.trim(), a: a.join("|").trim() }; }).filter((f) => f.a);
  await db.programme.update({ where: { id }, data: {
    name: String(fd.get("name")).trim(), slug, type: String(fd.get("type")) as never, qualificationType: String(fd.get("qualificationType") ?? "").trim() || null,
    awardingBody: String(fd.get("awardingBody") ?? "").trim() || null, summary: String(fd.get("summary") ?? "").trim() || null, description: String(fd.get("description") ?? "").trim() || null,
    objectives: lines(fd.get("objectives")), entryRequirements: lines(fd.get("entryRequirements")), careers: lines(fd.get("careers")), deliveryModes: fd.getAll("deliveryModes").map(String),
    modules, faqs, durationMonths: num(fd.get("durationMonths")), heroImage: String(fd.get("heroImage") ?? "").trim() || null, feeRwf: num(fd.get("feeRwf")), feeUsd: num(fd.get("feeUsd")), registrationFeeRwf: num(fd.get("registrationFeeRwf")),
    visualTheme: String(fd.get("visualTheme") ?? "default"), reviewNotes: String(fd.get("reviewNotes") ?? "").trim() || null,
    events: { create: { actorName: s.name, action: "Edited details" } } } });
  redirect(`/admin/courses/${id}?ok=1`);
}

async function move(fd: FormData) {
  "use server";
  const id = String(fd.get("id")), to = String(fd.get("to"));
  const p = await db.programme.findUnique({ where: { id } });
  if (!p) return;
  const err = (m: string) => redirect(`/admin/courses/${id}?e=${encodeURIComponent(m)}`);
  let s: Session;
  const data: Record<string, unknown> = {};
  if (to === "SUBMITTED") {
    s = await who(can.editContent);
    if (p.status !== "DRAFT") return;
    const problems = readinessProblems(p); if (problems.length) err(problems.join(" "));
    data.submittedById = s.uid;
  } else if (to === "APPROVED") {
    s = await who(can.approve);
    if (p.status !== "SUBMITTED") return;
    if (p.submittedById === s.uid && s.role !== "ADMIN") err("Another approver must approve content you submitted.");
    data.approvedById = s.uid;
  } else if (to === "DRAFT") {
    s = await who(can.editContent);
    if (!["SUBMITTED", "APPROVED", "ARCHIVED"].includes(p.status)) return;
  } else if (to === "PUBLISHED") {
    s = await who(can.publish);
    if (p.status !== "APPROVED") err("Only approved courses can be published.");
    const problems = readinessProblems(p); if (problems.length) err(problems.join(" "));
    data.publishedAt = new Date();
  } else if (to === "UNPUBLISH") {
    s = await who(can.publish);
    if (p.status !== "PUBLISHED") return;
    await db.programme.update({ where: { id }, data: { status: "APPROVED", events: { create: { actorName: s.name, action: "Unpublished" } } } });
    refresh(p.slug); redirect(`/admin/courses/${id}`);
  } else if (to === "ARCHIVED") {
    s = await who(can.publish);
    // Applications and history stay. An archived course is no longer public, so nobody can apply to it.
    await db.programme.update({ where: { id }, data: { status: "ARCHIVED", events: { create: { actorName: s.name, action: "Archived" } } } });
    refresh(p.slug); redirect(`/admin/courses/${id}`);
  } else return;
  await db.programme.update({ where: { id }, data: { ...data, status: to as never, events: { create: { actorName: s.name, action: `Moved to ${label(to)}` } } } });
  refresh(p.slug); redirect(`/admin/courses/${id}`);
}

async function uploadImage(fd: FormData) {
  "use server";
  const s = await who(can.editContent);
  const id = String(fd.get("id")), f = fd.get("file"), back = (m: string) => redirect(`/admin/courses/${id}?e=${encodeURIComponent(m)}`);
  const p = await db.programme.findUnique({ where: { id } });
  if (!p) return;
  if (p.status === "PUBLISHED" || p.status === "ARCHIVED") back("Unpublish the course before changing its image.");
  if (!(f instanceof File) || f.size === 0) back("Choose an image file.");
  const file = f as File;
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) back("Use a JPG, PNG or WebP image.");
  if (file.size > 4 * 1024 * 1024) back("The image is larger than 4 MB. Resize it to about 1600 pixels wide.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const a = await db.asset.create({ data: { name: file.name.slice(0, 120), mime: file.type, data: bytes } });
  await db.programme.update({ where: { id }, data: { heroImage: `/api/assets/${a.id}`, events: { create: { actorName: s.name, action: "Changed course image" } } } });
  redirect(`/admin/courses/${id}?ok=1`);
}

async function removeImage(fd: FormData) {
  "use server";
  const s = await who(can.editContent); const id = String(fd.get("id"));
  const p = await db.programme.findUnique({ where: { id } });
  if (!p || p.status === "PUBLISHED" || p.status === "ARCHIVED") redirect(`/admin/courses/${id}?e=${encodeURIComponent("Unpublish the course before changing its image.")}`);
  await db.programme.update({ where: { id }, data: { heroImage: null, events: { create: { actorName: s.name, action: "Removed course image" } } } });
  redirect(`/admin/courses/${id}?ok=1`);
}

export default async function Edit({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ e?: string; ok?: string }> }) {
  const { id } = await params; const sp = await searchParams;
  const me = (await getSession())!;
  const p = await db.programme.findUnique({ where: { id }, include: { events: { orderBy: { createdAt: "desc" }, take: 12 }, _count: { select: { applicants: true } } } });
  if (!p) notFound();
  const locked = p.status === "PUBLISHED" || p.status === "ARCHIVED";
  const problems = readinessProblems(p);
  const T = (n: string, v: string, rows = 4, hint?: string) => (<><label htmlFor={n}>{hint ?? n}</label><textarea id={n} name={n} rows={rows} defaultValue={v} disabled={locked} style={{ width: "100%" }} /></>);
  const btn = (to: string, text: string, ok: boolean, cls = "") => ok && <form action={move} style={{ display: "inline" }}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="to" value={to} /><button className={cls} type="submit">{text}</button></form>;
  return (<><div className="top"><h1>{p.name}</h1><p>{categoryLabel(p.type)} · <span className={`pill ${p.status === "PUBLISHED" ? "ok" : "warn"}`}>{label(p.status)}</span> · {p._count.applicants} applicants</p></div>
    {sp.e && <p className="err" role="alert">{sp.e}</p>}{sp.ok && <p className="pill ok" role="status">Saved</p>}
    <div className="panel" style={{ marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <a href={`/preview/${p.slug}`} target="_blank" rel="noreferrer">Preview landing page</a>
      {btn("SUBMITTED", "Submit for review", p.status === "DRAFT" && can.editContent(me.role), "p")}
      {btn("APPROVED", "Approve", p.status === "SUBMITTED" && can.approve(me.role), "p")}
      {btn("DRAFT", "Return to draft", ["SUBMITTED", "APPROVED", "ARCHIVED"].includes(p.status) && can.editContent(me.role))}
      {btn("PUBLISHED", "Publish", p.status === "APPROVED" && can.publish(me.role), "p")}
      {btn("UNPUBLISH", "Unpublish", p.status === "PUBLISHED" && can.publish(me.role))}
      {btn("ARCHIVED", "Archive", p.status !== "ARCHIVED" && can.publish(me.role))}
    </div>
    {problems.length > 0 && p.status === "DRAFT" && <div className="notice" style={{ marginBottom: 16 }}><b>Before submitting:</b><ul className="ol">{problems.map((x) => <li key={x}>{x}</li>)}</ul></div>}
    <form action={save} className="panel form" style={{ maxWidth: "none" }}><input type="hidden" name="id" value={p.id} />
      <label htmlFor="name">Official title</label><input id="name" name="name" defaultValue={p.name} required disabled={locked} />
      <label htmlFor="slug">Web address (slug)</label><input id="slug" name="slug" defaultValue={p.slug ?? ""} disabled={locked} />
      <label htmlFor="type">Category</label><select id="type" name="type" defaultValue={p.type} disabled={locked}>{["IATA", "ICAO", "ADVANCED_CERTIFICATE", "CERTIFICATE", "ICT"].map((x) => <option key={x} value={x}>{categoryLabel(x as never)}</option>)}</select>
      <label htmlFor="qualificationType">Qualification type (for example: Certificate issued by Timtom Aviation School)</label><input id="qualificationType" name="qualificationType" defaultValue={p.qualificationType ?? ""} disabled={locked} />
      <label htmlFor="awardingBody">Certifying body, only if verified (leave empty for School-issued certificates)</label><input id="awardingBody" name="awardingBody" defaultValue={p.awardingBody ?? ""} disabled={locked} />
      <label htmlFor="summary">Short summary</label><input id="summary" name="summary" defaultValue={p.summary ?? ""} disabled={locked} />
      {T("description", p.description ?? "", 6, "Approved course description")}
      {T("objectives", p.objectives.join("\n"), 5, "Learning outcomes (one per line)")}
      {T("modules", asModules(p.modules).map((m) => m.description ? `${m.name} | ${m.description}` : m.name).join("\n"), 6, "Modules (one per line: Name | description)")}
      {T("entryRequirements", p.entryRequirements.join("\n"), 4, "Entry requirements (one per line)")}
      {T("careers", p.careers.join("\n"), 4, "Career pathways (one per line)")}
      {T("faqs", asFaqs(p.faqs).map((f) => `${f.q} | ${f.a}`).join("\n"), 4, "FAQs (one per line: Question | Answer)")}
      <label htmlFor="durationMonths">Duration (months). Leave empty until confirmed.</label><input id="durationMonths" name="durationMonths" type="number" min={1} defaultValue={p.durationMonths ?? ""} disabled={locked} />
      <input type="hidden" name="heroImage" value={p.heroImage ?? ""} />
      <fieldset disabled={locked}><legend>Delivery modes</legend>{[["ON_CAMPUS", "On campus"], ["ONLINE", "Online"]].map(([v, l]) => <label key={v} style={{ marginRight: 16 }}><input type="checkbox" name="deliveryModes" value={v} defaultChecked={p.deliveryModes.includes(v)} style={{ width: "auto" }} /> {l}</label>)}</fieldset>
      <label htmlFor="feeRwf">Approved tuition fee (RWF). Leave empty until approved.</label><input id="feeRwf" name="feeRwf" inputMode="numeric" defaultValue={p.feeRwf ?? ""} disabled={locked} />
      <label htmlFor="feeUsd">Approved tuition fee (USD)</label><input id="feeUsd" name="feeUsd" inputMode="numeric" defaultValue={p.feeUsd ?? ""} disabled={locked} />
      <label htmlFor="registrationFeeRwf">Registration fee (RWF). Applicants are invoiced this on applying.</label><input id="registrationFeeRwf" name="registrationFeeRwf" inputMode="numeric" defaultValue={p.registrationFeeRwf ?? ""} disabled={locked} />
      <label htmlFor="visualTheme">Subject area (also sets the artwork and catalogue filter)</label><select id="visualTheme" name="visualTheme" defaultValue={p.visualTheme} disabled={locked}>{THEME_KEYS.map((k) => <option key={k} value={k}>{THEMES[k].name}</option>)}</select>
      <label htmlFor="reviewNotes">Internal review notes (not shown publicly)</label><textarea id="reviewNotes" name="reviewNotes" rows={2} defaultValue={p.reviewNotes ?? ""} disabled={locked} />
      {!locked && <button className="p" type="submit">Save draft</button>}{locked && <p className="notice">Unpublish or return to draft to edit.</p>}
    </form>
    <div className="panel" style={{ marginTop: 16 }}><h2>Course image</h2>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>Shown on the catalogue card and at the top of the course page. Use a licensed photograph, about 1600 pixels wide. Without one, the page shows aviation artwork.</p>
      {p.heroImage && <p><img src={p.heroImage} alt="" style={{ maxWidth: 320, borderRadius: 8 }} /></p>}
      {!locked && can.editContent(me.role) && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <form action={uploadImage} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><input type="hidden" name="id" value={p.id} /><input type="file" name="file" accept="image/jpeg,image/png,image/webp" aria-label="Course image file" required /><button className="p" type="submit">Upload image</button></form>
        {p.heroImage && <form action={removeImage}><input type="hidden" name="id" value={p.id} /><button type="submit">Remove image</button></form>}</div>}</div>
    <div className="panel" style={{ marginTop: 16 }}><h2>History</h2><ul className="ol">{p.events.map((e) => <li key={e.id}>{e.createdAt.toISOString().slice(0, 16).replace("T", " ")} · {e.actorName}: {e.action}</li>)}</ul></div></>);
}
