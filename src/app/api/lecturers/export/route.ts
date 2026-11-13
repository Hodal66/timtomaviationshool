import { getSession } from "@/lib/session";
import { exportLecturers, MANAGERS } from "@/lib/lecturers";
/** LEC-05 export. Bank details and rates are left out of the file on purpose. */
export async function GET() {
  const s = await getSession(); if (!s || !MANAGERS.includes(s.role)) return new Response("Forbidden", { status: 403 });
  return new Response("﻿" + (await exportLecturers()), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="lecturers-${new Date().toISOString().slice(0, 10)}.csv"`, "cache-control": "private, no-store" } });
}
