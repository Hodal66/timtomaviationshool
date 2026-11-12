import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { can } from "@/lib/perm";
import { categoryLabel, slugify } from "@/lib/catalogue";
import { label } from "@/lib/format";
export const dynamic = "force-dynamic";

async function create(fd: FormData) {
  "use server";
  const s = await getSession();
  if (!s || !can.editContent(s.role)) throw new Error("Not allowed");
  const name = String(fd.get("name") ?? "").trim();
  if (!name) return;
  let slug = slugify(name);
  if (await db.programme.findUnique({ where: { slug } })) slug += "-" + Math.random().toString(36).slice(2, 5);
  const code = "C" + Math.random().toString(36).slice(2, 7).toUpperCase();
  const p = await db.programme.create({ data: { code, name, slug, type: String(fd.get("type")) as never, durationMonths: 6, events: { create: { actorName: s.name, action: "Created draft" } } } });
  redirect(`/admin/courses/${p.id}`);
}

export default async function Courses({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { s } = await searchParams;
  const me = await getSession();
  const rows = await db.programme.findMany({ where: s ? { status: s as never } : {}, orderBy: [{ status: "asc" }, { name: "asc" }], include: { _count: { select: { applicants: true } } } });
  return (<><div className="top"><h1>Courses</h1><p>Draft, review, approve and publish. Only published courses appear on the website.</p></div>
    <form className="panel" style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
      <label htmlFor="s"><b>Show</b></label><select id="s" name="s" defaultValue={s ?? ""}><option value="">All</option>{["DRAFT", "SUBMITTED", "APPROVED", "PUBLISHED", "ARCHIVED"].map((x) => <option key={x} value={x}>{label(x)}</option>)}</select><button type="submit">Filter</button></form>
    <div className="panel tbl"><table><thead><tr><th>Course</th><th>Category</th><th>Status</th><th>Applicants</th><th></th></tr></thead><tbody>
      {rows.map((p) => <tr key={p.id}><td>{p.name}{p.reviewNotes && <small style={{ display: "block", color: "var(--warn)", whiteSpace: "normal", maxWidth: 360 }}>{p.reviewNotes}</small>}</td><td>{categoryLabel(p.type)}</td>
        <td><span className={`pill ${p.status === "PUBLISHED" ? "ok" : p.status === "ARCHIVED" ? "bad" : "warn"}`}>{label(p.status)}</span></td><td>{p._count.applicants}</td><td><a href={`/admin/courses/${p.id}`}>Open</a></td></tr>)}
    </tbody></table></div>
    {me && can.editContent(me.role) && <form action={create} className="panel" style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
      <b style={{ width: "100%" }}>New course</b><input name="name" placeholder="Official course title" required style={{ minWidth: 260 }} />
      <select name="type" aria-label="Category"><option value="IATA">IATA programme</option><option value="ICAO">ICAO programme</option><option value="ADVANCED_CERTIFICATE">Advanced certificate</option><option value="CERTIFICATE">Certificate</option><option value="ICT">ICT programme</option></select>
      <button className="p" type="submit">Create draft</button></form>}</>);
}
