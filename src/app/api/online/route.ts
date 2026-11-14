import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { importMeetAttendance } from "@/lib/online";
/** VCL-04: upload the Google Meet attendance report (CSV) for one session. */
export async function POST(req: Request) {
  const s = await getSession(); if (!s) return Response.json({ error: "Sign in again." }, { status: 401 });
  const f = await req.formData().catch(() => null); const file = f?.get("file"); if (!f || !(file instanceof File) || !file.size) return Response.json({ error: "Choose the attendance report file." }, { status: 400 }); if (file.size > 1024 * 1024) return Response.json({ error: "The file is larger than 1 MB." }, { status: 413 });
  const r = await importMeetAttendance({ uid: s.uid, name: s.name, role: s.role }, String(f.get("slotId") ?? ""), String(f.get("date") ?? ""), await file.text()); revalidatePath("/online");
  return typeof r === "string" ? Response.json({ error: r }, { status: 400 }) : Response.json({ ok: true, ...r });
}
