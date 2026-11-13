import { revalidatePath } from "next/cache";
import { limited, clientIp } from "@/lib/ratelimit";
import { applyForJob, CV_MAX } from "@/lib/recruitment";
/** LEC-08: public job application with CV (rate limited). */
export async function POST(req: Request) {
  if (limited(`apply-job:${clientIp(req.headers)}`, 10, 60e3)) return Response.json({ error: "Too many requests. Wait a minute and try again." }, { status: 429, headers: { "retry-after": "60" } });
  const f = await req.formData().catch(() => null); if (!f) return Response.json({ error: "Invalid form." }, { status: 400 });
  const file = f.get("cv"); let cv: { name: string; type: string; bytes: Uint8Array } | null = null;
  if (file instanceof File && file.size) { if (file.size > CV_MAX) return Response.json({ error: "The CV is larger than 4 MB." }, { status: 413 }); cv = { name: file.name, type: file.type, bytes: new Uint8Array(await file.arrayBuffer()) }; }
  const answers: Record<string, string> = {}; for (const [k, v] of f.entries()) if (/^q\d+$/.test(k)) answers[k.slice(1)] = String(v);
  const r = await applyForJob(String(f.get("slug") ?? ""), { fullName: String(f.get("fullName") ?? ""), email: String(f.get("email") ?? ""), phone: String(f.get("phone") ?? ""), coverNote: String(f.get("coverNote") ?? ""), answers }, cv);
  if (typeof r === "string") return Response.json({ error: r }, { status: 400 }); revalidatePath("/recruitment"); return Response.json(r);
}
