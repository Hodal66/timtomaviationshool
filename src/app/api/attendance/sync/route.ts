import { teacherOf } from "@/lib/teach-auth";
import { saveMarks } from "@/lib/teaching";
/** Roll-call save, also used to sync marks captured offline on the lecturer's phone. Repeating the same request is harmless. */
export async function POST(req: Request) {
  const b = await req.json().catch(() => null); const t = await teacherOf(String(b?.slotId ?? "")); if (!t) return Response.json({ ok: false, error: "Not allowed." }, { status: 403 });
  const r = await saveMarks(String(b.slotId), String(b?.date ?? ""), Array.isArray(b?.marks) ? b.marks : [], b?.offline ? "OFFLINE" : "ROLL");
  return "error" in r ? Response.json({ ok: false, error: r.error }, { status: 400 }) : Response.json({ ok: true, saved: r.saved });
}
