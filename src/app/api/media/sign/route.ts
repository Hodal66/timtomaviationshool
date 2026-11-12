import { getSession } from "@/lib/session";
import { can } from "@/lib/perm";
import { signUpload } from "@/lib/cloudinary";
export async function POST() {
  const s = await getSession(); if (!s || !can.editContent(s.role)) return new Response("Forbidden", { status: 403 });
  const p = signUpload(); return p ? Response.json(p, { headers: { "cache-control": "no-store" } }) : Response.json({ error: "Cloudinary is not configured." }, { status: 503 });
}
