import { destroyApplicantSession } from "@/lib/otp";
export async function POST() { await destroyApplicantSession(); return Response.json({ ok: true }); }
