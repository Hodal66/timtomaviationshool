import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

export async function middleware(req: NextRequest) {
  const t = req.cookies.get("tas_session")?.value;
  try {
    if (!t) throw new Error();
    await jwtVerify(t, new TextEncoder().encode(process.env.AUTH_SECRET ?? ""));
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/login", req.url));
  }
}
export const config = { matcher: ["/dashboard/:path*", "/admissions/:path*", "/payments/:path*", "/certificates/:path*", "/admin/:path*", "/enquiries/:path*", "/executive/:path*", "/timetable/:path*", "/attendance/:path*"] };
