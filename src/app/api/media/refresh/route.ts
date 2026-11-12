import { revalidatePath, revalidateTag } from "next/cache";
import { getSession } from "@/lib/session";
import { can } from "@/lib/perm";
export async function POST() {
  const s = await getSession(); if (!s || !can.editContent(s.role)) return new Response("Forbidden", { status: 403 });
  revalidateTag("media"); revalidatePath("/gallery"); revalidatePath("/"); revalidatePath("/media"); return Response.json({ ok: true });
}
