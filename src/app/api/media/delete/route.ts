import { revalidatePath, revalidateTag } from "next/cache";
import { getSession } from "@/lib/session";
import { can } from "@/lib/perm";
import { deleteMedia } from "@/lib/cloudinary";
export async function POST(req: Request) {
  const s = await getSession(); if (!s || !can.editContent(s.role)) return new Response("Forbidden", { status: 403 });
  const b = await req.json().catch(() => null); const ok = typeof b?.id === "string" && (await deleteMedia(b.id));
  if (ok) { revalidateTag("media"); revalidatePath("/gallery"); revalidatePath("/"); revalidatePath("/media"); }
  return Response.json({ ok }, { status: ok ? 200 : 400 });
}
