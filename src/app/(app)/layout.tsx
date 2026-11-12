import { redirect } from "next/navigation";
import { getSession, destroySession } from "@/lib/session";

async function logout() { "use server"; await destroySession(); redirect("/login"); }

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  if (!s) redirect("/login");
  return (<div className="shell"><nav className="side" aria-label="Modules">
    <b>TAS-One</b>
    <a href="/dashboard">Dashboard</a><a href="/executive">Executive</a><a href="/admissions">Admissions</a><a href="/enquiries">Enquiries</a><a href="/messages">Messages</a><a href="/admin/courses">Courses</a><a href="/timetable">Timetable</a><a href="/attendance">Attendance</a>
    <a href="/media">Media</a><a href="/payments">Payments</a><a href="/certificates">Certificates</a>
    <form action={logout}><small style={{ display: "block", padding: "0 10px 6px" }}>{s.name}</small><button className="s" type="submit">Sign out</button></form>
  </nav><main>{children}</main></div>);
}
