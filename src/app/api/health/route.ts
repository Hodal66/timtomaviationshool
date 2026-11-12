import { db } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const [r] = await db.$queryRaw<{ now: Date }[]>`select now() as now`;
    const programmes = await db.programme.count();
    return Response.json({ ok: true, dbTime: r.now, programmes });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
