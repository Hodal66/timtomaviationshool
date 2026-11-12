import type { Metadata } from "next";
import { Reveal } from "@/components/Reveal";
import { EnquiryForm } from "@/components/EnquiryForm";
import { SITE } from "@/lib/site";
export const metadata: Metadata = { title: "Contact | Timtom Aviation School", description: "Contact Timtom Aviation School admissions by phone, email or message.", alternates: { canonical: "/contact" } };

export default function Contact() {
  return (<>
    <section className="pagehead"><div className="wrap"><Reveal className="shead"><span className="eyebrow">Contact</span><h1>Talk to admissions</h1><p className="lead">Questions about programmes, intakes or fees? We are happy to help.</p></Reveal></div></section>
    <section className="sx" style={{ paddingTop: 24 }}><div className="wrap split" style={{ alignItems: "start" }}>
      <Reveal><div className="panel2 vstack" style={{ gap: 20 }}>
        <div><small style={{ color: "var(--mute)" }}>Phone</small><br /><a href={`tel:${SITE.phone}`} style={{ fontSize: "1.2rem", fontWeight: 600 }}>{SITE.phoneDisplay}</a></div>
        <div><small style={{ color: "var(--mute)" }}>Email</small><br /><a href={`mailto:${SITE.email}`} style={{ fontSize: "1.2rem", fontWeight: 600 }}>{SITE.email}</a></div>
        <div><small style={{ color: "var(--mute)" }}>Address</small><br /><b style={{ fontSize: "1.2rem" }}>{SITE.address}</b></div>
        {SITE.whatsapp && <div><a className="btn pri sm" href={`https://wa.me/${SITE.whatsapp}`}>Chat on WhatsApp</a></div>}</div></Reveal>
      <Reveal delay={100}><div className="panel2"><h2 style={{ fontSize: "1.5rem", marginBottom: 18 }}>Send a message</h2><EnquiryForm id="contact" /></div></Reveal>
    </div></section></>);
}
