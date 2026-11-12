import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { can } from "@/lib/perm";
import { db } from "@/lib/db";
import { DataTable, type Col, type Row } from "@/components/dash/DataTable";
import { getT } from "@/lib/i18n/server";
export const dynamic = "force-dynamic";
export default async function Certificates() {
  const me = await getSession(); if (!me || !can.reports(me.role)) redirect("/dashboard");
  const { t } = await getT();
  const rows = await db.certificate.findMany({ include: { holder: true, programme: true }, orderBy: { issuedOn: "desc" } });
  const cols: Col[] = [{ key: "no", label: t("Number") }, { key: "holder", label: t("Holder") }, { key: "prog", label: t("Programme"), filter: true }, { key: "issuer", label: t("Issuer"), filter: true }, { key: "status", label: t("Status"), filter: true }];
  const data: Row[] = rows.map((c) => ({ id: c.id, v: { no: c.number, holder: c.holder.fullName, prog: c.programme.name, issuer: c.issuer, status: c.status === "VALID" ? "Valid" : "Revoked" }, c: { status: <span className={`pill ${c.status === "VALID" ? "ok" : "bad"}`}>{c.status === "VALID" ? "Valid" : "Revoked"}</span> } }));
  return (<><div className="top"><div><h1>{t("Certificates")}</h1><p>{t("Public verification at")} <a href="/verify">/verify</a></p></div></div>
    <div className="panel"><DataTable id="certificates" cols={cols} rows={data} exportName="certificates" empty={t("No certificates yet.")} /></div></>);
}
