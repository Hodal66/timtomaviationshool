import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession, type Session } from "@/lib/session";
import { can } from "@/lib/perm";
import { asFaqs, asModules, categoryLabel, readinessProblems, slugify, SESSION_TEXT, THEMES, THEME_KEYS } from "@/lib/catalogue";
import { listOfferings } from "@/lib/offerings";
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
    await db.$transaction([db.programme.update({ where: { id }, data: { status: "APPROVED", events: { create: { actorName: s.name, action: "Unpublished" } } } }), db.programmeOffering.updateMany({ where: { programmeId: id, status: "OPEN" }, data: { status: "CLOSED" } })]);
    refresh(p.slug); redirect(`/admin/courses/${id}`);
  } else if (to === "ARCHIVED") {
    s = await who(can.publish);
    // Applications and history stay. Open offerings close so nobody can apply to an archived course.
    await db.$transaction([db.programme.update({ where: { id }, data: { status: "ARCHIVED", events: { create: { actorName: s.name, action: "Archived" } } } }), db.programmeOffering.updateMany({ where: { programmeId: id, status: { not: "CLOSED" } }, data: { status: "CLOSED" } })]);
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

async function addOffering(fd: FormData) {
  "use server";
  const s = await who(can.editContent);
  const programmeId = String(fd.get("id")), seats = num(fd.get("seats"));
  const intakeLabel = String(fd.get("intake") ?? "").trim(), start = String(fd.get("startsOn") ?? "");
  if (!seats || !intakeLabel || !start) redirect(`/admin/courses/${programmeId}?e=${encodeURIComponent("Enter an intake name, start date and seats.")}`);
  const startsOn = new Date(start + "T00:00:00Z");
  const intake = await db.intake.upsert({ where: { label: intakeLabel }, update: {}, create: { label: intakeLabel, startsOn, endsOn: new Date(+startsOn + 182 * 864e5) } });
  const deadline = String(fd.get("deadline") ?? "");
  try {
    await db.programmeOffering.create({ data: { programmeId, intakeId: intake.id, branchId: String(fd.get("branchId")), session: String(fd.get("session")) as never, seats, deadline: deadline ? new Date(deadline + "T23:59:59Z") : null, status: "DRAFT" } });
  } catch { redirect(`/admin/courses/${programmeId}?e=${encodeURIComponent("That intake, branch and schedule already exists.")}`); }
  await db.programmeEvent.create({ data: { programmeId, actorName: s.name, action: `Added offering ${intakeLabel}` } });
  redirect(`/admin/courses/${programmeId}`);
}

async function offering(fd: FormData) {
  "use server";
  const s = await who(can.publish);
  const id = String(fd.get("oid")), op = String(fd.get("op"));
  const o = await db.programmeOffering.findUnique({ where: { id }, include: { programme: true } });
  if (!o) return;
  if (op === "open" && o.programme.status !== "PUBLISHED") redirect(`/admin/courses/${o.programmeId}?e=${encodeURIComponent("Publish the course before opening an intake.")}`);
  const data = op === "open" ? { status: "OPEN" as const } : op === "close" ? { status: "CLOSED" as const } : { seats: num(fd.get("seats")) ?? o.seats };
  await db.programmeOffering.update({ where: { id }, data });
  await db.programmeEvent.create({ data: { programmeId: o.programmeId, actorName: s.name, action: `Offering ${op}` } });
  refresh(o.programme.slug); redirect(`/admin/courses/${o.programmeId}`);
}

export default async function Edit({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ e?: string; ok?: string }> }) {
  const { id } = await params; const sp = await searchParams;
  const me = (await getSession())!;
  const p = await db.programme.findUnique({ where: { id }, include: { events: { orderBy: { createdAt: "desc" }, take: 12 }, _count: { select: { applicants: true } } } });
  if (!p) notFound();
  const [branches, offs] = await Promise.all([db.branch.findMany(), listOfferings(p.id)]);
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
    <div className="panel" style={{ marginTop: 16 }}><h2>Intakes and seats</h2>
      <div className="tbl"><table><thead><tr><th>Intake</th><th>Branch</th><th>Schedule</th><th>Seats</th><th>Left</th><th>Deadline</th><th>Status</th><th></th></tr></thead><tbody>
        {offs.length === 0 && <tr><td colSpan={8}>No intakes yet.</td></tr>}
        {offs.map((o) => <tr key={o.id}><td>{o.intake.label}</td><td>{o.branch.name}</td><td style={{ whiteSpace: "normal" }}>{SESSION_TEXT[o.session]}</td><td>{o.seats}</td><td>{o.seatsLeft}</td><td>{o.deadline?.toISOString().slice(0, 10) ?? "-"}</td><td><span className={`pill ${o.status === "OPEN" ? "ok" : "warn"}`}>{label(o.status)}</span></td>
          <td>{can.publish(me.role) && <form action={offering} style={{ display: "flex", gap: 4 }}><input type="hidden" name="oid" value={o.id} /><input name="seats" type="number" defaultValue={o.seats} aria-label="Seats" style={{ width: 70 }} />
            <button className="s" name="op" value="seats">Set seats</button>{o.status !== "OPEN" ? <button className="s" name="op" value="open">Open</button> : <button className="s" name="op" value="close">Close</button>}</form>}</td></tr>)}
      </tbody></table></div>
      {can.editContent(me.role) && <form action={addOffering} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}><input type="hidden" name="id" value={p.id} />
        <input name="intake" placeholder="Intake name, e.g. January 2027" required /><input name="startsOn" type="date" aria-label="Start date" required />
        <select name="branchId" aria-label="Branch">{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
        <select name="session" aria-label="Session"><option value="WEEKDAY">Weekday</option><option value="WEEKEND">Weekend</option></select>
        <input name="seats" type="number" min={1} placeholder="Seats" required style={{ width: 90 }} /><input name="deadline" type="date" aria-label="Application deadline" />
        <button className="p" type="submit">Add intake</button></form>}
    </div>
    <div className="panel" style={{ marginTop: 16 }}><h2>History</h2><ul className="ol">{p.events.map((e) => <li key={e.id}>{e.createdAt.toISOString().slice(0, 16).replace("T", " ")} · {e.actorName}: {e.action}</li>)}</ul></div></>);
}
